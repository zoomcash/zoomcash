import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Auth: admin only
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Payment intents counts
    const { count: piTotal } = await supabase.from("payment_intents").select("*", { count: "exact", head: true });
    const { count: piSucceeded } = await supabase.from("payment_intents").select("*", { count: "exact", head: true }).eq("status", "succeeded");
    const { count: piFailed } = await supabase.from("payment_intents").select("*", { count: "exact", head: true }).eq("status", "failed");
    const { count: piProcessing } = await supabase.from("payment_intents").select("*", { count: "exact", head: true }).eq("status", "processing");

    // Gateway tx counts (24h)
    const { count: txCreated24h } = await supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).gte("created_at", last24h);
    const { count: txPaid24h } = await supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "paid").gte("created_at", last24h);
    const { count: txFailed24h } = await supabase.from("gateway_transactions").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", last24h);

    // Webhook stats
    const { count: webhookTotal } = await supabase.from("webhook_events").select("*", { count: "exact", head: true }).gte("created_at", last7d);
    const { count: webhookInvalid } = await supabase.from("webhook_events").select("*", { count: "exact", head: true }).eq("signature_valid", false).gte("created_at", last7d);

    // Delivery stats
    const { count: deliveryFailed } = await supabase.from("webhook_deliveries").select("*", { count: "exact", head: true }).eq("status", "failed");
    const { count: deliveryPending } = await supabase.from("webhook_deliveries").select("*", { count: "exact", head: true }).eq("status", "pending");

    // Fraud alerts
    const { count: fraudAlerts } = await supabase.from("fraud_scores").select("*", { count: "exact", head: true }).gte("risk_score", 70).gte("created_at", last7d);

    // Reconciliation
    const { count: reconUnresolved } = await supabase.from("reconciliation_checks").select("*", { count: "exact", head: true }).eq("resolved", false);

    // Security events (24h)
    const { count: securityEvents24h } = await supabase.from("security_events").select("*", { count: "exact", head: true }).gte("created_at", last24h);

    // Active merchants
    const { count: activeMerchants } = await supabase.from("merchants").select("*", { count: "exact", head: true }).eq("status", "active");

    // Queue stats
    const { count: queuePending } = await supabase.from("processing_queue").select("*", { count: "exact", head: true }).eq("status", "pending");

    return new Response(JSON.stringify({
      timestamp: now.toISOString(),
      payment_intents: {
        total: piTotal || 0,
        succeeded: piSucceeded || 0,
        failed: piFailed || 0,
        processing: piProcessing || 0,
      },
      transactions_24h: {
        created: txCreated24h || 0,
        paid: txPaid24h || 0,
        failed: txFailed24h || 0,
        success_rate: txCreated24h ? ((txPaid24h || 0) / txCreated24h * 100).toFixed(1) + "%" : "N/A",
      },
      webhooks_7d: {
        received: webhookTotal || 0,
        invalid_signatures: webhookInvalid || 0,
      },
      deliveries: {
        pending: deliveryPending || 0,
        failed: deliveryFailed || 0,
      },
      fraud: {
        high_risk_alerts_7d: fraudAlerts || 0,
      },
      reconciliation: {
        unresolved_mismatches: reconUnresolved || 0,
      },
      security: {
        events_24h: securityEvents24h || 0,
      },
      infrastructure: {
        active_merchants: activeMerchants || 0,
        queue_pending: queuePending || 0,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Metrics error:", err);
    return new Response(JSON.stringify({ error: "Failed to generate metrics" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
