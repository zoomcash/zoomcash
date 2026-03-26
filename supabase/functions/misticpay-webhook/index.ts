import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function deriveWebhookToken(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret + ":webhook-verify");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const misticSecret = Deno.env.get("MISTICPAY_CLIENT_SECRET");
    if (!misticSecret) {
      console.error("MISTICPAY_CLIENT_SECRET not configured");
      return new Response(JSON.stringify({ error: "Not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook token
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const expectedToken = await deriveWebhookToken(misticSecret);
    if (token !== expectedToken) {
      console.error("Webhook token mismatch");
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const transactionId = body.transactionId || body.data?.transactionId;
    const status = body.status || body.data?.transactionState || body.transactionState;
    const transactionType = body.transactionType || body.data?.transactionType || "";

    if (!transactionId) {
      console.error("No transactionId in webhook payload");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPaid =
      status === "APROVADO" ||
      status === "PAGO" ||
      status === "COMPLETED" ||
      status === "approved" ||
      status === "paid";

    const isFailed =
      status === "FALHOU" ||
      status === "FAILED" ||
      status === "CANCELADO" ||
      status === "REJECTED" ||
      status === "rejected" ||
      status === "failed";

    const isWithdrawal =
      transactionType === "SAQUE" ||
      transactionType === "WITHDRAW" ||
      transactionType === "cashout" ||
      transactionType === "CASHOUT";

    // --- WITHDRAWAL processing ---
    if (isWithdrawal) {
      const { data: withdrawal } = await supabase
        .from("withdrawals")
        .select("*")
        .like("admin_note", `%txId: ${transactionId}%`)
        .eq("status", "processing")
        .single();

      if (!withdrawal) {
        console.log("No processing withdrawal found for txId:", transactionId);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Acquire lock to prevent double processing ──
      const lockKey = `withdrawal-webhook:${withdrawal.id}`;
      const { data: lockAcquired } = await supabase.rpc("try_acquire_lock", {
        _lock_key: lockKey,
        _locked_by: "misticpay-webhook",
        _ttl_seconds: 60,
      });

      if (!lockAcquired) {
        console.log(`Lock already held for withdrawal ${withdrawal.id}, skipping`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        if (isPaid) {
          await supabase
            .from("withdrawals")
            .update({
              status: "completed",
              admin_note: `${withdrawal.admin_note} | Confirmado via webhook`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", withdrawal.id)
            .eq("status", "processing"); // Extra safety: only update if still processing

          console.log(`Withdrawal ${withdrawal.id} completed via webhook`);
        } else if (isFailed) {
          // Use atomic refund function (prevents double-refund via FOR UPDATE lock)
          const { data: refunded } = await supabase.rpc("process_withdrawal_failure", {
            _withdrawal_id: withdrawal.id,
            _failure_reason: `Webhook: ${status}`,
          });

          if (refunded) {
            console.log(`Withdrawal ${withdrawal.id} failed, refunded R$ ${withdrawal.amount}`);
          } else {
            console.log(`Withdrawal ${withdrawal.id} already processed, skipping refund`);
          }
        }
      } finally {
        await supabase.rpc("release_lock", { _lock_key: lockKey });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DEPOSIT processing ---
    const { data: deposit } = await supabase
      .from("deposits")
      .select("*")
      .or(`misticpay_transaction_id.eq.${transactionId},transaction_id.eq.${transactionId}`)
      .eq("status", "pending")
      .single();

    if (!deposit) {
      console.log("No pending deposit found for transaction:", transactionId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isPaid) {
      // ── Acquire lock for deposit processing ──
      const lockKey = `deposit-webhook:${deposit.id}`;
      const { data: lockAcquired } = await supabase.rpc("try_acquire_lock", {
        _lock_key: lockKey,
        _locked_by: "misticpay-webhook",
        _ttl_seconds: 60,
      });

      if (!lockAcquired) {
        console.log(`Lock already held for deposit ${deposit.id}, skipping`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        // Fetch platform deposit fees
        const { data: feesData } = await supabase
          .from("platform_fees")
          .select("pix_fee_percent, pix_fee_fixed")
          .limit(1)
          .single();

        const feePercent = feesData?.pix_fee_percent ?? 0;
        const feeFixed = feesData?.pix_fee_fixed ?? 1.0;
        const grossAmount = Number(deposit.amount);
        const feeAmount = Number((grossAmount * feePercent / 100 + feeFixed).toFixed(2));
        const netAmount = Number((grossAmount - feeAmount).toFixed(2));
        const creditAmount = netAmount > 0 ? netAmount : grossAmount;

        // Use atomic deposit processing function (FOR UPDATE lock + idempotency check)
        const { data: processed, error: procError } = await supabase.rpc("process_deposit_payment", {
          _deposit_id: deposit.id,
          _fee_amount: feeAmount,
          _credit_amount: creditAmount,
        });

        if (procError) {
          console.error("process_deposit_payment error:", procError);
          // Generate alert
          await supabase.from("financial_alerts").insert({
            alert_type: "deposit_processing_error",
            severity: "critical",
            description: `Atomic deposit processing failed for deposit ${deposit.id}`,
            metadata: { deposit_id: deposit.id, error: procError.message, amount: grossAmount },
          });
        } else if (processed) {
          console.log(`Deposit ${deposit.id} completed, gross R$ ${grossAmount}, fee R$ ${feeAmount}, credited R$ ${creditAmount}`);

          // Process referral commission (non-critical)
          try {
            await supabase.rpc("process_referral_commission", {
              _referred_user_id: deposit.user_id,
              _deposit_id: deposit.id,
              _deposit_amount: grossAmount,
            });
          } catch (refErr) {
            console.error("Referral commission error (non-fatal):", refErr);
          }
        } else {
          console.log(`Deposit ${deposit.id} already processed, skipping`);
        }
      } finally {
        await supabase.rpc("release_lock", { _lock_key: lockKey });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
