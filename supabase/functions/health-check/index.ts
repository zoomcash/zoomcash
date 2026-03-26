import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const staleThreshold = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  type HealthStatus = "healthy" | "degraded" | "critical";
  const checks: Record<string, { status: HealthStatus; details: Record<string, unknown> }> = {};

  try {
    // 1. Database connectivity
    const dbStart = Date.now();
    const { error: dbErr } = await supabase.from("merchants").select("id", { count: "exact", head: true });
    const dbLatency = Date.now() - dbStart;
    checks.database = {
      status: dbErr ? "critical" : dbLatency > 2000 ? "degraded" : "healthy",
      details: { latency_ms: dbLatency, error: dbErr?.message || null },
    };

    // 2. Provider configuration
    const misticConfigured = !!Deno.env.get("MISTICPAY_CLIENT_ID") && !!Deno.env.get("MISTICPAY_CLIENT_SECRET");
    checks.providers = {
      status: misticConfigured ? "healthy" : "degraded",
      details: { misticpay: misticConfigured ? "configured" : "missing_credentials" },
    };

    // 3. Transaction health
    const [
      { count: pendingTx },
      { count: stalePending },
      { count: failedTx24h },
      { count: paidTx24h },
    ] = await Promise.all([
      supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "pending").lt("created_at", staleThreshold),
      supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", last24h),
      supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "paid").gte("created_at", last24h),
    ]);

    const staleCount = stalePending || 0;
    checks.transactions = {
      status: staleCount > 10 ? "critical" : staleCount > 3 ? "degraded" : "healthy",
      details: {
        pending: pendingTx || 0,
        stale_pending_30min: staleCount,
        failed_24h: failedTx24h || 0,
        paid_24h: paidTx24h || 0,
      },
    };

    // 4. Webhook delivery health
    const [
      { count: failedDeliveries },
      { count: pendingDeliveries },
    ] = await Promise.all([
      supabase.from("webhook_deliveries").select("*", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("webhook_deliveries").select("*", { count: "exact", head: true }).in("status", ["pending", "retrying"]),
    ]);

    const failedDel = failedDeliveries || 0;
    checks.webhooks = {
      status: failedDel > 20 ? "critical" : failedDel > 5 ? "degraded" : "healthy",
      details: { failed: failedDel, pending: pendingDeliveries || 0 },
    };

    // 5. Processing queue health
    const { count: queuePending } = await supabase
      .from("processing_queue").select("*", { count: "exact", head: true }).eq("status", "pending");

    const qp = queuePending || 0;
    checks.queue = {
      status: qp > 100 ? "critical" : qp > 30 ? "degraded" : "healthy",
      details: { pending_items: qp },
    };

    // 6. Reconciliation health
    const { count: unresolvedRecon } = await supabase
      .from("reconciliation_checks").select("*", { count: "exact", head: true }).eq("resolved", false);

    const ur = unresolvedRecon || 0;
    checks.reconciliation = {
      status: ur > 10 ? "critical" : ur > 3 ? "degraded" : "healthy",
      details: { unresolved: ur },
    };

    // 7. Security events
    const { count: secEvents1h } = await supabase
      .from("security_events").select("*", { count: "exact", head: true }).gte("created_at", last1h);

    const se = secEvents1h || 0;
    checks.security = {
      status: se > 50 ? "critical" : se > 20 ? "degraded" : "healthy",
      details: { events_last_1h: se },
    };

    // 8. Financial alerts
    const { count: unresolvedAlerts } = await supabase
      .from("financial_alerts").select("*", { count: "exact", head: true }).eq("resolved", false).eq("severity", "critical");

    const ua = unresolvedAlerts || 0;
    checks.financial_alerts = {
      status: ua > 0 ? "critical" : "healthy",
      details: { unresolved_critical: ua },
    };

    // Overall status
    const statuses = Object.values(checks).map((c) => c.status);
    const overall: HealthStatus = statuses.includes("critical")
      ? "critical"
      : statuses.includes("degraded")
      ? "degraded"
      : "healthy";

    return new Response(
      JSON.stringify({
        status: overall,
        timestamp: now.toISOString(),
        version: "3.0.0",
        uptime: Deno.osUptime?.() || "unknown",
        checks,
      }),
      {
        status: overall === "critical" ? 503 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Health check error:", err);
    return new Response(
      JSON.stringify({
        status: "critical",
        timestamp: now.toISOString(),
        error: "Health check failed",
        checks,
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
