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
      return jsonRes({ error: "MisticPay não configurado" }, 500);
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

    const amount = body.amount;

    // Type validation
    if (amount === undefined || amount === null) {
      return jsonRes({ error: "Campo 'amount' é obrigatório" }, 400);
    }
    if (typeof amount !== "number" || isNaN(amount)) {
      return jsonRes({ error: "Campo 'amount' deve ser um número" }, 400);
    }
    // Range validation
    if (amount < 2) {
      return jsonRes({ error: "Valor mínimo: R$ 2,00" }, 400);
    }
    if (amount > 50000) {
      return jsonRes({ error: "Valor máximo: R$ 50.000,00" }, 400);
    }
    // Block unexpected fields
    const allowedFields = new Set(["amount"]);
    for (const key of Object.keys(body)) {
      if (!allowedFields.has(key)) {
        return jsonRes({ error: `Campo inesperado: ${key}` }, 400);
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Idempotency: prevent duplicate deposits in short window ──
    // Check if user has a pending deposit created in the last 2 minutes with same amount
    const { data: recentDeposit } = await supabaseAdmin
      .from("deposits")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("amount", Number(amount))
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentDeposit) {
      return jsonRes({
        error: "Depósito duplicado detectado. Aguarde o depósito anterior ser processado.",
        existingDepositId: recentDeposit.id,
      }, 409);
    }

    // ── Acquire processing lock ──
    const lockKey = `deposit:${user.id}`;
    const { data: lockAcquired } = await supabaseAdmin.rpc("try_acquire_lock", {
      _lock_key: lockKey,
      _locked_by: `create-deposit:${user.id}`,
      _ttl_seconds: 60,
    });

    if (!lockAcquired) {
      return jsonRes({ error: "Operação em andamento. Tente novamente em instantes." }, 429);
    }

    try {
      // Get user profile for payer info
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("display_name, cpf")
        .eq("user_id", user.id)
        .single();

      const depositId = crypto.randomUUID();

      // Create MisticPay transaction
      const misticRes = await fetch("https://api.misticpay.com/api/transactions/create", {
        method: "POST",
        headers: {
          ci: misticClientId,
          cs: misticClientSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(amount),
          payerName: profile?.display_name || "Jogador",
          payerDocument: profile?.cpf || "00000000000",
          transactionId: depositId,
          description: `Depósito FluxPay - R$ ${Number(amount).toFixed(2)}`,
          projectWebhook: `${supabaseUrl}/functions/v1/misticpay-webhook?token=${await deriveWebhookToken(misticClientSecret)}`,
        }),
      });

      const misticData = await misticRes.json();

      if (!misticRes.ok) {
        console.error("MisticPay error:", misticData);
        // Generate operational alert
        await supabaseAdmin.from("financial_alerts").insert({
          alert_type: "provider_error",
          severity: "warning",
          description: "MisticPay deposit creation failed",
          metadata: { user_id: user.id, amount, error: misticData?.message || "Unknown", endpoint: "create-deposit" },
        });
        return jsonRes({ error: "Erro ao gerar PIX" }, 500);
      }

      // Save deposit record
      await supabaseAdmin.from("deposits").insert({
        id: depositId,
        user_id: user.id,
        amount: Number(amount),
        status: "pending",
        transaction_id: depositId,
        misticpay_transaction_id: String(misticData.data?.transactionId || ""),
        qrcode_url: misticData.data?.qrcodeUrl || "",
        copy_paste: misticData.data?.copyPaste || "",
      });

      return jsonRes({
        depositId,
        qrcodeUrl: misticData.data?.qrcodeUrl,
        qrCodeBase64: misticData.data?.qrCodeBase64,
        copyPaste: misticData.data?.copyPaste,
        amount: Number(amount),
      });
    } finally {
      // Always release lock
      await supabaseAdmin.rpc("release_lock", { _lock_key: lockKey });
    }
  } catch (err) {
    console.error("create-deposit error:", err);
    return jsonRes({ error: "Erro interno" }, 500);
  }
});
