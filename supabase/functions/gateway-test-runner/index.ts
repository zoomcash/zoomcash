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

// ── Auth ──
async function authenticateAdmin(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return null;
  const userId = user.id;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return null;
  return userId;
}

// ── Test Result Logger ──
async function logTest(
  supabase: ReturnType<typeof createClient>,
  name: string,
  category: string,
  status: "passed" | "failed" | "error",
  result: Record<string, unknown>,
  adminId: string,
  startTime: number,
  errorMessage?: string,
) {
  const duration = Date.now() - startTime;
  await supabase.from("gateway_test_runs").insert({
    test_name: name,
    test_category: category,
    status,
    result,
    error_message: errorMessage || null,
    executed_by: adminId,
    duration_ms: duration,
  });
  return { test_name: name, status, result, duration_ms: duration, error_message: errorMessage };
}

// ── Ensure sandbox merchant exists ──
async function ensureSandboxMerchant(supabase: ReturnType<typeof createClient>, adminId: string): Promise<string | null> {
  // Try to find an existing active merchant
  const { data: existing } = await supabase
    .from("merchants")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create a sandbox merchant for testing
  const apiKey = `gw_sandbox_${crypto.randomUUID().replace(/-/g, "")}`;
  const apiKeyPrefix = apiKey.substring(0, 12);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const apiKeyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  const { data: merchant, error } = await supabase
    .from("merchants")
    .insert({
      name: "Sandbox Test Merchant",
      user_id: adminId,
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
      status: "active",
      webhook_url: null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create sandbox merchant:", JSON.stringify(error));
    // Retry: maybe another concurrent test just created it
    const { data: retry } = await supabase
      .from("merchants")
      .select("id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return retry?.id || null;
  }
  return merchant.id;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST: Simulate Payment (sandbox - no real money)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testSimulatePayment(
  supabase: ReturnType<typeof createClient>,
  adminId: string,
  params: { merchant_id?: string; amount?: number; result_type?: string }
) {
  const start = Date.now();
  const name = "simulate_payment";
  try {
    const amount = params.amount || 100;
    const resultType = params.result_type || "success";

    // Get or create a sandbox merchant
    let merchantId = params.merchant_id;
    if (!merchantId) {
      merchantId = await ensureSandboxMerchant(supabase, adminId);
      if (!merchantId) return logTest(supabase, name, "payment", "error", {}, adminId, start, "Failed to get/create sandbox merchant");
    }

    // Create a sandbox transaction (marked as sandbox in metadata)
    const idempotencyKey = `sandbox_test_${crypto.randomUUID()}`;
    const { data: txId, error: txError } = await supabase.rpc("create_gateway_transaction", {
      _merchant_id: merchantId,
      _amount: amount,
      _idempotency_key: idempotencyKey,
      _payment_method: "pix",
      _description: `[SANDBOX TEST] Simulated ${resultType} payment`,
      _metadata: { sandbox: true, test_type: "simulate_payment", result_type: resultType },
    });

    if (txError) return logTest(supabase, name, "payment", "failed", { error: txError.message }, adminId, start);

    // Simulate the result
    if (resultType === "success") {
      const { error: statusErr } = await supabase.rpc("update_gateway_tx_status", {
        _tx_id: txId,
        _new_status: "processing",
      });
      if (statusErr) return logTest(supabase, name, "payment", "failed", { error: statusErr.message }, adminId, start);

      const { error: paidErr } = await supabase.rpc("update_gateway_tx_status", {
        _tx_id: txId,
        _new_status: "paid",
        _provider_tx_id: `sandbox_provider_${crypto.randomUUID().slice(0, 8)}`,
      });
      if (paidErr) return logTest(supabase, name, "payment", "failed", { error: paidErr.message }, adminId, start);

      // Verify ledger entry was created
      const { data: ledger } = await supabase.from("ledger_entries")
        .select("id, entry_type, amount")
        .eq("transaction_id", txId);

      const hasCredit = ledger?.some((e: any) => e.entry_type === "credit");
      const hasFee = ledger?.some((e: any) => e.entry_type === "fee");

      if (!hasCredit || !hasFee) {
        return logTest(supabase, name, "payment", "failed", {
          transaction_id: txId,
          ledger_entries: ledger?.length || 0,
          has_credit: hasCredit,
          has_fee: hasFee,
          reason: "Ledger entries missing after paid status",
        }, adminId, start);
      }

      return logTest(supabase, name, "payment", "passed", {
        transaction_id: txId,
        amount,
        status: "paid",
        ledger_entries: ledger?.length,
      }, adminId, start);

    } else if (resultType === "failed") {
      await supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "processing" });
      const { error: failErr } = await supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "failed" });
      if (failErr) return logTest(supabase, name, "payment", "failed", { error: failErr.message }, adminId, start);

      // Verify NO ledger entry for failed
      const { data: ledger } = await supabase.from("ledger_entries").select("id").eq("transaction_id", txId);
      if (ledger && ledger.length > 0) {
        return logTest(supabase, name, "payment", "failed", { reason: "Ledger entries created for failed payment!", ledger_count: ledger.length }, adminId, start);
      }
      return logTest(supabase, name, "payment", "passed", { transaction_id: txId, status: "failed", ledger_entries: 0 }, adminId, start);

    } else {
      // pending - just verify it stays pending
      const { data: tx } = await supabase.from("gateway_transactions").select("status").eq("id", txId).single();
      return logTest(supabase, name, "payment", tx?.status === "pending" ? "passed" : "failed", { transaction_id: txId, status: tx?.status }, adminId, start);
    }
  } catch (e) {
    return logTest(supabase, name, "payment", "error", {}, adminId, start, String(e));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST: Idempotency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testIdempotency(supabase: ReturnType<typeof createClient>, adminId: string) {
  const start = Date.now();
  const name = "idempotency";
  try {
    const merchantId = await ensureSandboxMerchant(supabase, adminId);
    if (!merchantId) return logTest(supabase, name, "idempotency", "error", {}, adminId, start, "Failed to get/create sandbox merchant");

    const idempotencyKey = `sandbox_idemp_${crypto.randomUUID()}`;

    // First call
    const { data: txId1 } = await supabase.rpc("create_gateway_transaction", {
      _merchant_id: merchantId,
      _amount: 50,
      _idempotency_key: idempotencyKey,
      _payment_method: "pix",
      _description: "[SANDBOX TEST] Idempotency test",
      _metadata: { sandbox: true, test_type: "idempotency" },
    });

    // Second call (same key)
    const { data: txId2 } = await supabase.rpc("create_gateway_transaction", {
      _merchant_id: merchantId,
      _amount: 50,
      _idempotency_key: idempotencyKey,
      _payment_method: "pix",
      _description: "[SANDBOX TEST] Idempotency test duplicate",
      _metadata: { sandbox: true, test_type: "idempotency" },
    });

    const passed = txId1 === txId2;
    return logTest(supabase, name, "idempotency", passed ? "passed" : "failed", {
      first_tx: txId1,
      second_tx: txId2,
      same_id: passed,
      reason: passed ? "Same transaction returned (idempotent)" : "DIFFERENT transactions created - idempotency BROKEN!",
    }, adminId, start);
  } catch (e) {
    return logTest(supabase, name, "idempotency", "error", {}, adminId, start, String(e));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST: Race Condition (duplicate webhook)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testRaceCondition(supabase: ReturnType<typeof createClient>, adminId: string) {
  const start = Date.now();
  const name = "race_condition";
  try {
    const merchantId = await ensureSandboxMerchant(supabase, adminId);
    if (!merchantId) return logTest(supabase, name, "race_condition", "error", {}, adminId, start, "Failed to get/create sandbox merchant");

    // Create a transaction
    const key = `sandbox_race_${crypto.randomUUID()}`;
    const { data: txId } = await supabase.rpc("create_gateway_transaction", {
      _merchant_id: merchantId,
      _amount: 200,
      _idempotency_key: key,
      _payment_method: "pix",
      _description: "[SANDBOX TEST] Race condition test",
      _metadata: { sandbox: true, test_type: "race_condition" },
    });

    if (!txId) return logTest(supabase, name, "race_condition", "error", {}, adminId, start, "Failed to create tx");

    // Move to processing first
    await supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "processing" });

    // Simulate concurrent "paid" status updates
    const results = await Promise.allSettled([
      supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "paid", _provider_tx_id: "race_1" }),
      supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "paid", _provider_tx_id: "race_2" }),
      supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "paid", _provider_tx_id: "race_3" }),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled" && !(r.value as any).error).length;
    const failures = results.filter((r) => r.status === "fulfilled" && (r.value as any).error).length;

    // Check ledger: should have exactly ONE credit entry
    const { data: ledger } = await supabase.from("ledger_entries")
      .select("id, entry_type, amount")
      .eq("transaction_id", txId)
      .eq("entry_type", "credit");

    const creditCount = ledger?.length || 0;
    const passed = creditCount === 1;

    return logTest(supabase, name, "race_condition", passed ? "passed" : "failed", {
      transaction_id: txId,
      concurrent_attempts: 3,
      successful_updates: successes,
      rejected_updates: failures,
      ledger_credit_entries: creditCount,
      reason: passed
        ? "Only 1 credit entry created (race condition protected)"
        : `${creditCount} credit entries created - DUPLICATE BALANCE!`,
    }, adminId, start);
  } catch (e) {
    return logTest(supabase, name, "race_condition", "error", {}, adminId, start, String(e));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST: Invalid Status Transition
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testInvalidTransition(supabase: ReturnType<typeof createClient>, adminId: string) {
  const start = Date.now();
  const name = "invalid_status_transition";
  try {
    const merchantId = await ensureSandboxMerchant(supabase, adminId);
    if (!merchantId) return logTest(supabase, name, "validation", "error", {}, adminId, start, "Failed to get/create sandbox merchant");

    const key = `sandbox_transition_${crypto.randomUUID()}`;
    const { data: txId } = await supabase.rpc("create_gateway_transaction", {
      _merchant_id: merchantId,
      _amount: 75,
      _idempotency_key: key,
      _payment_method: "pix",
      _description: "[SANDBOX TEST] Invalid transition test",
      _metadata: { sandbox: true, test_type: "invalid_transition" },
    });

    // Try invalid transition: pending → paid (should fail, must go through processing)
    const { error: invalidErr } = await supabase.rpc("update_gateway_tx_status", {
      _tx_id: txId,
      _new_status: "paid",
    });

    const passed = !!invalidErr;
    return logTest(supabase, name, "validation", passed ? "passed" : "failed", {
      transaction_id: txId,
      attempted_transition: "pending → paid",
      blocked: passed,
      reason: passed
        ? "Invalid transition correctly blocked"
        : "CRITICAL: Invalid transition was ALLOWED!",
    }, adminId, start);
  } catch (e) {
    return logTest(supabase, name, "validation", "error", {}, adminId, start, String(e));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST: Ledger Consistency
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testLedgerConsistency(supabase: ReturnType<typeof createClient>, adminId: string) {
  const start = Date.now();
  const name = "ledger_consistency";
  try {
    // Validate all merchants' ledger balances
    const { data: merchants } = await supabase.from("merchants").select("id, name").eq("status", "active");
    if (!merchants || merchants.length === 0) {
      return logTest(supabase, name, "financial", "passed", { reason: "No merchants to validate" }, adminId, start);
    }

    const results: any[] = [];
    let allConsistent = true;

    for (const m of merchants) {
      const { data: validation } = await supabase.rpc("validate_ledger_balance", { _merchant_id: m.id });
      const consistent = validation?.consistent ?? true;
      if (!consistent) allConsistent = false;
      results.push({
        merchant_id: m.id,
        merchant_name: m.name,
        consistent,
        computed_balance: validation?.computed_balance,
        last_recorded: validation?.last_recorded_balance,
      });
    }

    return logTest(supabase, name, "financial", allConsistent ? "passed" : "failed", {
      merchants_checked: results.length,
      all_consistent: allConsistent,
      details: results,
    }, adminId, start);
  } catch (e) {
    return logTest(supabase, name, "financial", "error", {}, adminId, start, String(e));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST: Refund blocks negative balance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testRefundNegativeBalance(supabase: ReturnType<typeof createClient>, adminId: string) {
  const start = Date.now();
  const name = "refund_negative_balance";
  try {
    const merchantId = await ensureSandboxMerchant(supabase, adminId);
    if (!merchantId) return logTest(supabase, name, "financial", "error", {}, adminId, start, "Failed to get/create sandbox merchant");

    // Create and pay a small transaction
    const key = `sandbox_refund_${crypto.randomUUID()}`;
    const { data: txId } = await supabase.rpc("create_gateway_transaction", {
      _merchant_id: merchantId,
      _amount: 999999, // Huge amount to attempt refund on
      _idempotency_key: key,
      _payment_method: "pix",
      _description: "[SANDBOX TEST] Refund negative balance test",
      _metadata: { sandbox: true, test_type: "refund_negative" },
    });

    // Move through the lifecycle
    await supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "processing" });
    await supabase.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "paid" });

    // Now try to refund - this should fail if merchant balance is insufficient
    const { error: refundErr } = await supabase.rpc("update_gateway_tx_status", {
      _tx_id: txId,
      _new_status: "refunded",
    });

    // Whether it passes or errors, we need to check the merchant balance didn't go negative
    const { data: balance } = await supabase.rpc("get_merchant_balance", { _merchant_id: merchantId });
    const balanceNonNeg = (balance ?? 0) >= 0;

    return logTest(supabase, name, "financial", balanceNonNeg ? "passed" : "failed", {
      transaction_id: txId,
      refund_blocked: !!refundErr,
      merchant_balance: balance,
      balance_non_negative: balanceNonNeg,
    }, adminId, start);
  } catch (e) {
    return logTest(supabase, name, "financial", "error", {}, adminId, start, String(e));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST: Webhook delivery retry
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function testWebhookRetry(supabase: ReturnType<typeof createClient>, adminId: string) {
  const start = Date.now();
  const name = "webhook_retry";
  try {
    // Check that failed webhook deliveries have correct retry behavior
    const { data: failed } = await supabase.from("webhook_deliveries")
      .select("id, attempts, max_attempts, status, next_retry_at")
      .eq("status", "failed")
      .limit(5);

    const { data: retrying } = await supabase.from("webhook_deliveries")
      .select("id, attempts, max_attempts, status")
      .eq("status", "retrying")
      .limit(5);

    // Check that no delivery exceeds max_attempts
    const overMax = [...(failed || []), ...(retrying || [])].filter(
      (d: any) => d.attempts > d.max_attempts
    );

    const passed = overMax.length === 0;
    return logTest(supabase, name, "webhook", passed ? "passed" : "failed", {
      failed_deliveries: failed?.length || 0,
      retrying_deliveries: retrying?.length || 0,
      over_max_attempts: overMax.length,
      reason: passed
        ? "All webhook deliveries within retry limits"
        : `${overMax.length} deliveries exceeded max_attempts!`,
    }, adminId, start);
  } catch (e) {
    return logTest(supabase, name, "webhook", "error", {}, adminId, start, String(e));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const adminId = await authenticateAdmin(req, supabase);
  if (!adminId) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/gateway-test-runner\/?/, "").replace(/\/$/, "");

  try {
    // ── POST /run-all ── Run all tests
    if (path === "run-all" && req.method === "POST") {
      // Ensure merchant exists before parallel tests
      await ensureSandboxMerchant(supabase, adminId);
      const results = await Promise.all([
        testSimulatePayment(supabase, adminId, { result_type: "success" }),
        testSimulatePayment(supabase, adminId, { result_type: "failed" }),
        testIdempotency(supabase, adminId),
        testRaceCondition(supabase, adminId),
        testInvalidTransition(supabase, adminId),
        testLedgerConsistency(supabase, adminId),
        testWebhookRetry(supabase, adminId),
      ]);

      const passed = results.filter((r: any) => r.status === "passed").length;
      const failed = results.filter((r: any) => r.status === "failed").length;
      const errors = results.filter((r: any) => r.status === "error").length;

      return json({
        summary: { total: results.length, passed, failed, errors },
        tests: results,
      });
    }

    // ── POST /run/:test ── Run a specific test
    if (path.startsWith("run/") && req.method === "POST") {
      const testName = path.replace("run/", "");
      const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

      let result;
      switch (testName) {
        case "simulate-payment":
          result = await testSimulatePayment(supabase, adminId, body);
          break;
        case "idempotency":
          result = await testIdempotency(supabase, adminId);
          break;
        case "race-condition":
          result = await testRaceCondition(supabase, adminId);
          break;
        case "invalid-transition":
          result = await testInvalidTransition(supabase, adminId);
          break;
        case "ledger-consistency":
          result = await testLedgerConsistency(supabase, adminId);
          break;
        case "refund-negative-balance":
          result = await testRefundNegativeBalance(supabase, adminId);
          break;
        case "webhook-retry":
          result = await testWebhookRetry(supabase, adminId);
          break;
        default:
          return json({ error: `Unknown test: ${testName}` }, 404);
      }
      return json(result);
    }

    // ── GET /results ── Get test history
    if (path === "results" && req.method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
      const { data } = await supabase.from("gateway_test_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      
      // Summary stats
      const passed = data?.filter((t: any) => t.status === "passed").length || 0;
      const failed = data?.filter((t: any) => t.status === "failed").length || 0;
      const errors = data?.filter((t: any) => t.status === "error").length || 0;

      return json({
        summary: { total: data?.length || 0, passed, failed, errors },
        data: data || [],
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Test runner error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
