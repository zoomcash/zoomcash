import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const misticClientSecret = Deno.env.get("MISTICPAY_CLIENT_SECRET")!;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Validate webhook token
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const expectedToken = (await hashKey(misticClientSecret + ":gateway-webhook")).slice(0, 32);

    const signatureValid = token === expectedToken;
    const sourceIp = req.headers.get("x-forwarded-for") || "unknown";

    // Timestamp validation — reject webhooks older than 10 minutes
    const webhookTimestamp = req.headers.get("x-webhook-timestamp");
    if (webhookTimestamp) {
      const ts = parseInt(webhookTimestamp, 10);
      if (!isNaN(ts) && Math.abs(Date.now() - ts) > 10 * 60 * 1000) {
        await supabaseAdmin.from("security_events").insert({
          event_type: "webhook_signature_invalid",
          ip_address: sourceIp,
          metadata: { reason: "timestamp_expired", timestamp: webhookTimestamp },
        });
        return new Response(JSON.stringify({ error: "Webhook timestamp expired" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    const payloadTransactionId = payload.transactionId || payload.transaction_id;
    const payloadStatus = payload.status?.toLowerCase();

    // ── Deduplication: check if this exact event was already processed ──
    if (payloadTransactionId && payloadStatus) {
      const { data: alreadyProcessed } = await supabaseAdmin
        .from("webhook_events")
        .select("id")
        .eq("event_type", payloadStatus)
        .eq("processed", true)
        .filter("payload->>transactionId", "eq", String(payloadTransactionId))
        .limit(1)
        .maybeSingle();

      if (alreadyProcessed) {
        console.log(`Duplicate webhook for tx ${payloadTransactionId} status ${payloadStatus}, skipping`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Log the webhook event
    const webhookEvent: Record<string, unknown> = {
      event_type: payload.status || "unknown",
      payload,
      signature: token,
      signature_valid: signatureValid,
      processed: false,
      source_ip: sourceIp,
    };

    // Try to match to a transaction
    if (payloadTransactionId) {
      // First try direct UUID match
      const { data: tx } = await supabaseAdmin
        .from("gateway_transactions")
        .select("id, merchant_id, status")
        .eq("id", payloadTransactionId)
        .maybeSingle();

      if (tx) {
        webhookEvent.transaction_id = tx.id;
      } else {
        // Try provider_transaction_id match
        const { data: tx2 } = await supabaseAdmin
          .from("gateway_transactions")
          .select("id, merchant_id, status")
          .eq("provider_transaction_id", String(payloadTransactionId))
          .maybeSingle();

        if (tx2) {
          webhookEvent.transaction_id = tx2.id;
        }
      }
    }

    // Insert webhook event
    await supabaseAdmin.from("webhook_events").insert(webhookEvent);

    if (!signatureValid) {
      await supabaseAdmin.from("security_events").insert({
        event_type: "webhook_signature_invalid",
        ip_address: sourceIp,
        metadata: { token, expected: expectedToken.slice(0, 8) + "..." },
      });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process the webhook if we found a transaction
    if (webhookEvent.transaction_id) {
      const txId = webhookEvent.transaction_id as string;
      const status = payloadStatus;

      // ── Acquire processing lock to prevent race conditions ──
      const lockKey = `gw-webhook:${txId}:${status}`;
      const { data: lockAcquired } = await supabaseAdmin.rpc("try_acquire_lock", {
        _lock_key: lockKey,
        _locked_by: "gateway-webhook",
        _ttl_seconds: 60,
      });

      if (!lockAcquired) {
        console.log(`Lock already held for ${lockKey}, skipping duplicate processing`);
        return new Response(JSON.stringify({ received: true, locked: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        let newStatus: string | null = null;
        if (status === "paid" || status === "approved" || status === "completed") {
          newStatus = "paid";
        } else if (status === "failed" || status === "rejected" || status === "expired") {
          newStatus = "failed";
        } else if (status === "refunded") {
          newStatus = "refunded";
        }

        if (newStatus) {
          const { error: statusError } = await supabaseAdmin.rpc("update_gateway_tx_status", {
            _tx_id: txId,
            _new_status: newStatus,
            _provider_tx_id: String(payloadTransactionId || ""),
          });

          if (statusError) {
            console.error("Status update error:", statusError);
            // Generate alert for failed status transition
            await supabaseAdmin.from("financial_alerts").insert({
              alert_type: "webhook_processing_error",
              severity: "warning",
              transaction_id: txId,
              description: `Webhook status transition failed: ${statusError.message}`,
              metadata: { tx_id: txId, attempted_status: newStatus, error: statusError.message },
            });
          } else {
            // Mark webhook as processed
            await supabaseAdmin
              .from("webhook_events")
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq("transaction_id", txId)
              .eq("processed", false);

            // Queue webhook delivery to merchant
            const { data: tx } = await supabaseAdmin
              .from("gateway_transactions")
              .select("merchant_id, amount, currency")
              .eq("id", txId)
              .single();

            if (tx) {
              await supabaseAdmin.from("webhook_deliveries").insert({
                merchant_id: tx.merchant_id,
                transaction_id: txId,
                event_type: `payment.${newStatus}`,
                payload: {
                  transaction_id: txId,
                  status: newStatus,
                  amount: tx.amount,
                  currency: tx.currency,
                },
                status: "pending",
                next_retry_at: new Date().toISOString(),
              });
            }
          }
        }
      } finally {
        // Release lock
        await supabaseAdmin.rpc("release_lock", { _lock_key: lockKey });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Gateway webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
