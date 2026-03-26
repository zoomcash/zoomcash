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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Auth: require admin JWT or service key
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify caller is admin
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const merchantId = url.searchParams.get("merchant_id");

  const results: {
    merchants_audited: number;
    inconsistencies: Array<{
      merchant_id: string;
      computed_balance: number;
      last_recorded_balance: number | null;
      difference: number;
    }>;
    duplicate_entries: Array<{ transaction_id: string; entry_type: string; count: number }>;
    negative_balances: Array<{ merchant_id: string; balance: number }>;
    summary: string;
  } = {
    merchants_audited: 0,
    inconsistencies: [],
    duplicate_entries: [],
    negative_balances: [],
    summary: "",
  };

  // 1. Get merchants to audit
  let merchantQuery = supabaseAdmin.from("merchants").select("id");
  if (merchantId) {
    merchantQuery = merchantQuery.eq("id", merchantId);
  }
  const { data: merchants } = await merchantQuery;
  if (!merchants || merchants.length === 0) {
    return new Response(JSON.stringify({ ...results, summary: "No merchants found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  results.merchants_audited = merchants.length;

  // 2. Validate each merchant's ledger balance
  for (const m of merchants) {
    const { data: validation } = await supabaseAdmin.rpc("validate_ledger_balance", {
      _merchant_id: m.id,
    });

    if (validation && !validation.consistent) {
      results.inconsistencies.push({
        merchant_id: m.id,
        computed_balance: validation.computed_balance,
        last_recorded_balance: validation.last_recorded_balance,
        difference: Math.abs(
          (validation.last_recorded_balance || 0) - validation.computed_balance
        ),
      });
    }

    // Check for negative balance
    const { data: balance } = await supabaseAdmin.rpc("get_merchant_balance", {
      _merchant_id: m.id,
    });
    if (balance !== null && balance < 0) {
      results.negative_balances.push({ merchant_id: m.id, balance });
    }
  }

  // 3. Check for duplicate ledger entries (same transaction_id + entry_type)
  const { data: dupes } = await supabaseAdmin.rpc("check_ledger_duplicates") as { data: any[] | null };
  // Fallback: raw query via a dedicated function or manual check
  if (!dupes) {
    // Query manually: find transaction_ids with >1 entry of same type
    const { data: ledgerEntries } = await supabaseAdmin
      .from("ledger_entries")
      .select("transaction_id, entry_type")
      .not("transaction_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (ledgerEntries) {
      const countMap = new Map<string, number>();
      for (const e of ledgerEntries) {
        const key = `${e.transaction_id}:${e.entry_type}`;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
      for (const [key, count] of countMap) {
        if (count > 1) {
          const [txId, entryType] = key.split(":");
          results.duplicate_entries.push({
            transaction_id: txId,
            entry_type: entryType,
            count,
          });
        }
      }
    }
  }

  // 4. Generate summary
  const issues = results.inconsistencies.length + results.duplicate_entries.length + results.negative_balances.length;
  results.summary = issues === 0
    ? `✅ All ${results.merchants_audited} merchants passed ledger audit. No inconsistencies found.`
    : `⚠️ Found ${issues} issue(s) across ${results.merchants_audited} merchants: ${results.inconsistencies.length} balance inconsistencies, ${results.duplicate_entries.length} duplicate entries, ${results.negative_balances.length} negative balances.`;

  // 5. Log audit event
  await supabaseAdmin.from("audit_log").insert({
    entity_type: "ledger_audit",
    entity_id: crypto.randomUUID(),
    action: "ledger_audit_executed",
    actor_type: "admin",
    actor_id: user.id,
    metadata: {
      merchants_audited: results.merchants_audited,
      issues_found: issues,
      timestamp: new Date().toISOString(),
    },
  });

  // 6. Create system alert if issues found
  if (issues > 0) {
    await supabaseAdmin.from("system_alerts").insert({
      alert_type: "ledger_audit_issues",
      severity: results.inconsistencies.length > 0 ? "critical" : "warning",
      message: results.summary,
      source: "ledger-audit",
      metadata: {
        inconsistencies: results.inconsistencies.length,
        duplicates: results.duplicate_entries.length,
        negative_balances: results.negative_balances.length,
      },
    });
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
