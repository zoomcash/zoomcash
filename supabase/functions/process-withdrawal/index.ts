import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function detectPixKeyType(pixKey: string): string {
  const cleaned = pixKey.replace(/[\s.\-\/]/g, "");
  if (/^\d{11}$/.test(cleaned)) return "CPF";
  if (/^\d{14}$/.test(cleaned)) return "CNPJ";
  if (/^\+?\d{10,15}$/.test(cleaned)) return "TELEFONE";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey.trim())) return "EMAIL";
  return "CHAVE_ALEATORIA";
}

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
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const misticClientId = Deno.env.get("MISTICPAY_CLIENT_ID");
    const misticClientSecret = Deno.env.get("MISTICPAY_CLIENT_SECRET");

    if (!misticClientId || !misticClientSecret) {
      return jsonRes({ error: "Gateway de pagamento não configurado" }, 500);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Usuário não encontrado" }, 401);

    // ── Schema Validation ──
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonRes({ error: "JSON inválido" }, 400);
    }

    const { amount, pixKey } = body as { amount?: unknown; pixKey?: unknown };

    // Validate amount
    if (amount === undefined || amount === null) {
      return jsonRes({ error: "Campo 'amount' é obrigatório" }, 400);
    }
    if (typeof amount !== "number" || isNaN(amount as number)) {
      return jsonRes({ error: "Campo 'amount' deve ser um número" }, 400);
    }
    if ((amount as number) < 2) {
      return jsonRes({ error: "Valor mínimo para saque: R$ 2,00" }, 400);
    }
    if ((amount as number) > 50000) {
      return jsonRes({ error: "Valor máximo para saque: R$ 50.000,00" }, 400);
    }

    // Validate pixKey
    if (!pixKey || typeof pixKey !== "string") {
      return jsonRes({ error: "Campo 'pixKey' é obrigatório e deve ser texto" }, 400);
    }
    if (pixKey.trim().length < 3 || pixKey.trim().length > 100) {
      return jsonRes({ error: "Chave PIX inválida (3-100 caracteres)" }, 400);
    }
    // Reject dangerous characters
    if (/[<>"';&|]/.test(pixKey)) {
      return jsonRes({ error: "Chave PIX contém caracteres inválidos" }, 400);
    }

    // Block unexpected fields
    const allowedFields = new Set(["amount", "pixKey"]);
    for (const key of Object.keys(body)) {
      if (!allowedFields.has(key)) {
        return jsonRes({ error: `Campo inesperado: ${key}` }, 400);
      }
    }

    const numAmount = Number(amount);
    const cleanPixKey = (pixKey as string).trim();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Acquire processing lock (prevent double-submit) ──
    const lockKey = `withdrawal:${user.id}`;
    const { data: lockAcquired } = await supabaseAdmin.rpc("try_acquire_lock", {
      _lock_key: lockKey,
      _locked_by: `process-withdrawal:${user.id}`,
      _ttl_seconds: 120,
    });

    if (!lockAcquired) {
      return jsonRes({ error: "Saque já em processamento. Aguarde a conclusão." }, 429);
    }

    try {
      // ── Check for duplicate processing withdrawal ──
      const { data: existingWithdrawal } = await supabaseAdmin
        .from("withdrawals")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "processing")
        .limit(1)
        .maybeSingle();

      if (existingWithdrawal) {
        return jsonRes({ error: "Você já possui um saque em processamento" }, 409);
      }

      // Fetch platform fees
      const { data: feesData } = await supabaseAdmin
        .from("platform_fees")
        .select("withdrawal_fee_percent, withdrawal_fee_fixed")
        .limit(1)
        .single();

      const feePercent = feesData?.withdrawal_fee_percent ?? 0;
      const feeFixed = feesData?.withdrawal_fee_fixed ?? 1.0;
      const feeAmount = Number((numAmount * feePercent / 100 + feeFixed).toFixed(2));
      const netAmount = Number((numAmount - feeAmount).toFixed(2));

      if (netAmount <= 0) {
        return jsonRes({ error: "Valor muito baixo após taxas" }, 400);
      }

      // Check wallet balance
      const { data: walletData } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!walletData || walletData.balance < numAmount) {
        return jsonRes({ error: "Saldo insuficiente" }, 400);
      }

      // Debit full amount from user wallet
      const { error: debitError } = await supabaseAdmin.rpc("update_wallet_balance", {
        _user_id: user.id,
        _amount: numAmount,
        _type: "withdrawal",
        _description: `Saque PIX - R$ ${numAmount.toFixed(2)} (taxa: R$ ${feeAmount.toFixed(2)})`,
      });

      if (debitError) {
        return jsonRes({ error: debitError.message || "Erro ao debitar saldo" }, 400);
      }

      // Create withdrawal record
      const withdrawalId = crypto.randomUUID();
      await supabaseAdmin.from("withdrawals").insert({
        id: withdrawalId,
        user_id: user.id,
        amount: numAmount,
        pix_key: cleanPixKey,
        status: "processing",
      });

      // Detect PIX key type
      const pixKeyType = detectPixKeyType(cleanPixKey);
      const formattedPixKey = pixKeyType === "EMAIL" ? cleanPixKey : cleanPixKey.replace(/[\s.\-]/g, "");

      // Call MisticPay withdraw API
      const webhookUrl = `${supabaseUrl}/functions/v1/misticpay-webhook?token=${await deriveWebhookToken(misticClientSecret)}`;

      const misticRes = await fetch("https://api.misticpay.com/api/transactions/withdraw", {
        method: "POST",
        headers: {
          ci: misticClientId,
          cs: misticClientSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: netAmount,
          pixKey: formattedPixKey,
          pixKeyType,
          description: `Saque FluxPay - ${withdrawalId}`,
          projectWebhook: webhookUrl,
        }),
      });

      const misticData = await misticRes.json();

      if (!misticRes.ok) {
        console.error("MisticPay withdraw error:", misticData);

        // Use atomic refund function (prevents double-refund)
        await supabaseAdmin.rpc("process_withdrawal_failure", {
          _withdrawal_id: withdrawalId,
          _failure_reason: misticData?.message || "Erro no gateway",
        });

        // Generate operational alert
        await supabaseAdmin.from("financial_alerts").insert({
          alert_type: "provider_error",
          severity: "warning",
          description: "MisticPay withdrawal failed",
          metadata: { user_id: user.id, amount: numAmount, net_amount: netAmount, error: misticData?.message || "Unknown" },
        });

        return jsonRes({ error: misticData?.message || "Erro ao processar saque" }, 500);
      }

      // Update withdrawal with MisticPay transaction ID
      await supabaseAdmin
        .from("withdrawals")
        .update({
          status: "processing",
          admin_note: `MisticPay jobId: ${misticData.data?.jobId || ""}, txId: ${misticData.data?.transactionId || ""}`,
        })
        .eq("id", withdrawalId);

      console.log(`Withdrawal ${withdrawalId} queued via MisticPay for user ${user.id}`);

      return jsonRes({
        success: true,
        withdrawalId,
        status: "processing",
        message: "Saque enviado para processamento automático",
        feeAmount,
        netAmount,
        grossAmount: numAmount,
      });
    } finally {
      // Always release lock
      await supabaseAdmin.rpc("release_lock", { _lock_key: lockKey });
    }
  } catch (err) {
    console.error("process-withdrawal error:", err);
    return jsonRes({ error: "Erro interno ao processar saque" }, 500);
  }
});
