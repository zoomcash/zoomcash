import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Rate limit store
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

function checkLoginRL(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.blockedUntil) return false;
  if (!entry || now > entry.blockedUntil) {
    loginAttempts.set(ip, { count: 0, blockedUntil: 0 });
  }
  return true;
}

function recordLoginFailure(ip: string) {
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  entry.count++;
  if (entry.count >= 5) {
    entry.blockedUntil = Date.now() + 15 * 60 * 1000; // 15 min block
  }
  loginAttempts.set(ip, entry);
}

const adminRL = new Map<string, { count: number; resetAt: number }>();

function checkAdminRL(userId: string): boolean {
  const now = Date.now();
  const entry = adminRL.get(userId);
  if (!entry || now > entry.resetAt) {
    adminRL.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= 60; // 60 req/min for admin
}

// Auth middleware
async function authenticateAdmin(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: userData, error } = await anonClient.auth.getUser(token);
  if (error || !userData?.user) return null;

  const userId = userData.user.id;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return null;

  return userId;
}

// Audit log helper
async function auditLog(
  supabase: ReturnType<typeof createClient>,
  adminId: string,
  action: string,
  targetResource: string,
  metadata: unknown = {},
  ip: string = "unknown"
) {
  await supabase.from("audit_log").insert({
    entity_type: "admin_action",
    entity_id: adminId,
    action,
    actor_type: "admin",
    actor_id: adminId,
    metadata: { target_resource: targetResource, ...(metadata as Record<string, unknown>) },
    ip_address: ip,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/admin-api\/?/, "").replace(/\/$/, "");
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  // All routes require admin auth
  const adminId = await authenticateAdmin(req, supabase);
  if (!adminId) {
    recordLoginFailure(ip);
    await supabase.from("security_events").insert({
      event_type: "unauthorized_access" as any,
      ip_address: ip,
      metadata: { route: path, reason: "admin_auth_failed" },
    });
    return json({ error: "Unauthorized" }, 401);
  }

  if (!checkAdminRL(adminId)) {
    return json({ error: "Rate limit exceeded" }, 429);
  }

  try {
    // ── Input validation helpers ──
    function isValidUUID(s: string): boolean {
      return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s);
    }

    function validatePathUUID(match: RegExpMatchArray | null, index: number): string | null {
      if (!match) return null;
      const id = match[index];
      return isValidUUID(id) ? id : null;
    }

    // ── GET /internal/alerts ──
    if (path === "internal/alerts" && req.method === "GET") {
      const severity = url.searchParams.get("severity");
      let query = supabase.from("financial_alerts")
        .select("id, alert_type, severity, merchant_id, transaction_id, description, metadata, resolved, created_at")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (severity) query = query.eq("severity", severity);
      const { data } = await query;
      
      // Also fetch failed webhook deliveries count
      const { count: failedWebhooks } = await supabase
        .from("webhook_deliveries")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");
      
      // Stale pending transactions (>30 min)
      const { count: stalePending } = await supabase
        .from("gateway_transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      // Active processing locks (possible stuck operations)
      const { count: activeLocks } = await supabase
        .from("processing_locks")
        .select("*", { count: "exact", head: true })
        .gt("expires_at", new Date().toISOString());

      return json({
        alerts: data || [],
        summary: {
          unresolved_alerts: data?.length || 0,
          failed_webhooks: failedWebhooks || 0,
          stale_pending_transactions: stalePending || 0,
          active_processing_locks: activeLocks || 0,
        },
      });
    }

    // ── GET /merchants ──
    if (path === "merchants" && req.method === "GET") {
      const { data } = await supabase
        .from("merchants")
        .select("id, name, user_id, status, api_key_prefix, rate_limit_per_minute, webhook_url, created_at, updated_at")
        .order("created_at", { ascending: false });
      return json({ data: data || [] });
    }

    // ── POST /merchants/:id/suspend ──
    const suspendMatch = path.match(/^merchants\/([a-f0-9-]+)\/suspend$/);
    if (suspendMatch && req.method === "POST") {
      const merchantId = validatePathUUID(suspendMatch, 1);
      if (!merchantId) return json({ error: "Invalid merchant ID format" }, 400);
      const { data: before } = await supabase.from("merchants").select("status").eq("id", merchantId).single();
      if (!before) return json({ error: "Merchant not found" }, 404);
      const { error } = await supabase.from("merchants").update({ status: "suspended" }).eq("id", merchantId);
      if (error) return json({ error: error.message }, 400);
      await auditLog(supabase, adminId, "merchant_suspended", merchantId, { previous_status: before?.status }, ip);
      return json({ success: true });
    }

    // ── POST /merchants/:id/activate ──
    const activateMatch = path.match(/^merchants\/([a-f0-9-]+)\/activate$/);
    if (activateMatch && req.method === "POST") {
      const merchantId = validatePathUUID(activateMatch, 1);
      if (!merchantId) return json({ error: "Invalid merchant ID format" }, 400);
      const { error } = await supabase.from("merchants").update({ status: "active" }).eq("id", merchantId);
      if (error) return json({ error: error.message }, 400);
      await auditLog(supabase, adminId, "merchant_activated", merchantId, {}, ip);
      return json({ success: true });
    }

    // ── GET /payment-intents ──
    if (path === "payment-intents" && req.method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);
      const status = url.searchParams.get("status");
      const offset = (page - 1) * limit;

      let query = supabase.from("payment_intents")
        .select("id, merchant_id, amount, currency, status, payment_method, provider, risk_score, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq("status", status as any);
      const { data, count } = await query;
      return json({ data: data || [], pagination: { page, limit, total: count || 0 } });
    }

    // ── GET /gateway-transactions ──
    if (path === "gateway-transactions" && req.method === "GET") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);
      const status = url.searchParams.get("status");
      const offset = (page - 1) * limit;

      let query = supabase.from("gateway_transactions")
        .select("id, merchant_id, amount, currency, status, payment_method, risk_score, provider_transaction_id, paid_at, failed_at, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq("status", status);
      const { data, count } = await query;
      return json({ data: data || [], pagination: { page, limit, total: count || 0 } });
    }

    // ── GET /fraud-scores ──
    if (path === "fraud-scores" && req.method === "GET") {
      const { data } = await supabase.from("fraud_scores")
        .select("id, transaction_id, payment_intent_id, merchant_id, risk_score, flags, decision, ip_address, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ data: data || [] });
    }

    // ── GET /audit-log ──
    if (path === "audit-log" && req.method === "GET") {
      const { data } = await supabase.from("audit_log")
        .select("id, entity_type, entity_id, action, actor_type, actor_id, metadata, ip_address, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ data: data || [] });
    }

    // ── GET /security-events ──
    if (path === "security-events" && req.method === "GET") {
      const { data } = await supabase.from("security_events")
        .select("id, event_type, merchant_id, ip_address, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ data: data || [] });
    }

    // ── GET /reconciliation ──
    if (path === "reconciliation" && req.method === "GET") {
      const { data } = await supabase.from("reconciliation_checks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ data: data || [] });
    }

    // ── GET /webhook-deliveries ──
    if (path === "webhook-deliveries" && req.method === "GET") {
      const { data } = await supabase.from("webhook_deliveries")
        .select("id, merchant_id, transaction_id, event_type, status, attempts, last_error, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ data: data || [] });
    }

    // ── GET /processing-queue ──
    if (path === "processing-queue" && req.method === "GET") {
      const { data } = await supabase.from("processing_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ data: data || [] });
    }

    // ── GET /system-health ──
    if (path === "system-health" && req.method === "GET") {
      const now = new Date();
      const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [
        { count: pendingTx },
        { count: failedTx24h },
        { count: paidTx24h },
        { count: failedDeliveries },
        { count: pendingQueue },
        { count: unresolvedRecon },
        { count: highRiskAlerts },
        { count: securityEvents1h },
        { count: stalePending },
      ] = await Promise.all([
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", last24h),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "paid").gte("created_at", last24h),
        supabase.from("webhook_deliveries").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("processing_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reconciliation_checks").select("*", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("fraud_scores").select("*", { count: "exact", head: true }).gte("risk_score", 70).gte("created_at", last24h),
        supabase.from("security_events").select("*", { count: "exact", head: true }).gte("created_at", last1h),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "pending").lt("created_at", new Date(now.getTime() - 30 * 60 * 1000).toISOString()),
      ]);

      return json({
        timestamp: now.toISOString(),
        database: { status: "healthy" },
        providers: { misticpay: { configured: !!Deno.env.get("MISTICPAY_CLIENT_ID") } },
        alerts: {
          pending_transactions: pendingTx || 0,
          stale_pending: stalePending || 0,
          failed_transactions_24h: failedTx24h || 0,
          paid_transactions_24h: paidTx24h || 0,
          failed_webhook_deliveries: failedDeliveries || 0,
          pending_queue_items: pendingQueue || 0,
          unresolved_reconciliation: unresolvedRecon || 0,
          high_risk_alerts_24h: highRiskAlerts || 0,
          security_events_1h: securityEvents1h || 0,
        },
      });
    }

    // ── GET /metrics ──
    if (path === "metrics" && req.method === "GET") {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { count: piTotal }, { count: piSucceeded }, { count: piFailed },
        { count: txCreated24h }, { count: txPaid24h }, { count: txFailed24h },
        { count: activeMerchants },
      ] = await Promise.all([
        supabase.from("payment_intents").select("*", { count: "exact", head: true }),
        supabase.from("payment_intents").select("*", { count: "exact", head: true }).eq("status", "succeeded"),
        supabase.from("payment_intents").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).gte("created_at", last24h),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "paid").gte("created_at", last24h),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", last24h),
        supabase.from("merchants").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);

      return json({
        payment_intents: { total: piTotal || 0, succeeded: piSucceeded || 0, failed: piFailed || 0 },
        transactions_24h: {
          created: txCreated24h || 0,
          paid: txPaid24h || 0,
          failed: txFailed24h || 0,
          success_rate: txCreated24h ? `${((txPaid24h || 0) / txCreated24h * 100).toFixed(1)}%` : "N/A",
        },
        active_merchants: activeMerchants || 0,
      });
    }

    // ── GET /financial-alerts ──
    if (path === "financial-alerts" && req.method === "GET") {
      const resolved = url.searchParams.get("resolved");
      let query = supabase.from("financial_alerts")
        .select("id, alert_type, severity, merchant_id, transaction_id, description, metadata, resolved, resolved_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (resolved === "false") query = query.eq("resolved", false);
      if (resolved === "true") query = query.eq("resolved", true);
      const { data } = await query;
      return json({ data: data || [] });
    }

    // ── POST /financial-alerts/:id/resolve ──
    const resolveMatch = path.match(/^financial-alerts\/([a-f0-9-]+)\/resolve$/);
    if (resolveMatch && req.method === "POST") {
      const alertId = validatePathUUID(resolveMatch, 1);
      if (!alertId) return json({ error: "Invalid alert ID format" }, 400);
      const { error } = await supabase.from("financial_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: adminId })
        .eq("id", alertId);
      if (error) return json({ error: error.message }, 400);
      await auditLog(supabase, adminId, "financial_alert_resolved", alertId, {}, ip);
      return json({ success: true });
    }

    // ── POST /validate-ledger/:merchantId ──
    const validateMatch = path.match(/^validate-ledger\/([a-f0-9-]+)$/);
    if (validateMatch && req.method === "POST") {
      const merchantId = validatePathUUID(validateMatch, 1);
      if (!merchantId) return json({ error: "Invalid merchant ID format" }, 400);
      const { data, error } = await supabase.rpc("validate_ledger_balance", { _merchant_id: merchantId });
      if (error) return json({ error: error.message }, 400);
      await auditLog(supabase, adminId, "ledger_validated", merchantId, { result: data }, ip);
      return json({ data });
    }

    // ── GET /system-monitoring ──
    if (path === "system-monitoring" && req.method === "GET") {
      const now = new Date();
      const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: activeAlerts },
        { data: recentRateLimits },
        { data: recentMetrics },
        { count: pendingTx },
        { count: failedTx24h },
        { count: paidTx24h },
        { count: failedDeliveries },
        { count: highRiskAlerts24h },
        { count: securityEvents1h },
        { count: stalePending },
        { count: unresolvedRecon },
      ] = await Promise.all([
        supabase.from("system_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(20),
        supabase.from("rate_limit_events").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("system_metrics").select("*").gte("created_at", last24h).order("created_at", { ascending: false }).limit(100),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", last24h),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "paid").gte("created_at", last24h),
        supabase.from("webhook_deliveries").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("fraud_scores").select("*", { count: "exact", head: true }).gte("risk_score", 70).gte("created_at", last24h),
        supabase.from("security_events").select("*", { count: "exact", head: true }).gte("created_at", last1h),
        supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "pending").lt("created_at", new Date(now.getTime() - 30 * 60 * 1000).toISOString()),
        supabase.from("reconciliation_checks").select("*", { count: "exact", head: true }).eq("resolved", false),
      ]);

      // Aggregate metrics
      const metricsSummary: Record<string, number> = {};
      for (const m of (recentMetrics || [])) {
        metricsSummary[m.metric_name] = (metricsSummary[m.metric_name] || 0) + 1;
      }

      // Determine overall system health
      const criticalAlerts = (activeAlerts || []).filter((a: any) => a.severity === "critical").length;
      const systemHealth = criticalAlerts > 0 ? "critical" : (stalePending || 0) > 5 ? "degraded" : "healthy";

      return json({
        timestamp: now.toISOString(),
        system_health: systemHealth,
        database: { status: "healthy" },
        providers: { misticpay: { configured: !!Deno.env.get("MISTICPAY_CLIENT_ID") } },
        counters: {
          pending_transactions: pendingTx || 0,
          stale_pending: stalePending || 0,
          failed_transactions_24h: failedTx24h || 0,
          paid_transactions_24h: paidTx24h || 0,
          failed_webhook_deliveries: failedDeliveries || 0,
          high_risk_alerts_24h: highRiskAlerts24h || 0,
          security_events_1h: securityEvents1h || 0,
          unresolved_reconciliation: unresolvedRecon || 0,
        },
        active_alerts: activeAlerts || [],
        recent_rate_limits: recentRateLimits || [],
        metrics_summary: metricsSummary,
      });
    }

    // ── POST /system-alerts/:id/resolve ──
    const resolveAlertMatch = path.match(/^system-alerts\/([a-f0-9-]+)\/resolve$/);
    if (resolveAlertMatch && req.method === "POST") {
      const alertId = validatePathUUID(resolveAlertMatch, 1);
      if (!alertId) return json({ error: "Invalid alert ID format" }, 400);
      const { error } = await supabase.from("system_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: adminId })
        .eq("id", alertId);
      if (error) return json({ error: error.message }, 400);
      await auditLog(supabase, adminId, "system_alert_resolved", alertId, {}, ip);
      return json({ success: true });
    }

    // ── GET /rate-limit-events ──
    if (path === "rate-limit-events" && req.method === "GET") {
      const { data } = await supabase.from("rate_limit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ data: data || [] });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Admin API error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
