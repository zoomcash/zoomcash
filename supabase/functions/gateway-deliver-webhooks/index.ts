import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", encoder.encode(payload), key);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Fetch pending/retrying deliveries that are due
    const { data: deliveries, error } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("*, merchants!inner(webhook_url, webhook_secret)")
      .in("status", ["pending", "retrying"])
      .lte("next_retry_at", new Date().toISOString())
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error || !deliveries?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      const merchant = (delivery as any).merchants;
      if (!merchant?.webhook_url) {
        await supabaseAdmin
          .from("webhook_deliveries")
          .update({ status: "failed", last_error: "No webhook URL configured", attempts: delivery.attempts + 1 })
          .eq("id", delivery.id);
        failed++;
        continue;
      }

      const payloadStr = JSON.stringify(delivery.payload);
      const signature = await generateHmacSignature(payloadStr, merchant.webhook_secret);

      try {
        const res = await fetch(merchant.webhook_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Gateway-Signature": signature,
            "X-Gateway-Event": delivery.event_type,
            "X-Gateway-Delivery": delivery.id,
          },
          body: payloadStr,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        if (res.ok) {
          await supabaseAdmin
            .from("webhook_deliveries")
            .update({
              status: "sent",
              attempts: delivery.attempts + 1,
              last_response_code: res.status,
            })
            .eq("id", delivery.id);
          processed++;
        } else {
          const nextAttempt = delivery.attempts + 1;
          const backoffMs = Math.pow(2, nextAttempt) * 30_000; // Exponential backoff
          const nextRetry = new Date(Date.now() + backoffMs).toISOString();

          await supabaseAdmin
            .from("webhook_deliveries")
            .update({
              status: nextAttempt >= 5 ? "failed" : "retrying",
              attempts: nextAttempt,
              last_response_code: res.status,
              last_error: `HTTP ${res.status}`,
              next_retry_at: nextRetry,
            })
            .eq("id", delivery.id);
          failed++;
        }
      } catch (err) {
        const nextAttempt = delivery.attempts + 1;
        const backoffMs = Math.pow(2, nextAttempt) * 30_000;
        const nextRetry = new Date(Date.now() + backoffMs).toISOString();

        await supabaseAdmin
          .from("webhook_deliveries")
          .update({
            status: nextAttempt >= 5 ? "failed" : "retrying",
            attempts: nextAttempt,
            last_error: String(err),
            next_retry_at: nextRetry,
          })
          .eq("id", delivery.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, failed, total: deliveries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Deliver webhooks error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
