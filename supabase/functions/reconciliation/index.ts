import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const stats = {
    checked: 0,
    mismatches_detected: 0,
    auto_resolved: 0,
    duplicates_found: 0,
    critical_alerts: 0,
    stale_pending: 0,
  };

  try {
    // ── 1. Detect stale pending transactions (>30 min old) ──
    const { data: staleTxs } = await supabase
      .from("gateway_transactions")
      .select("id, merchant_id, status, provider_transaction_id, amount, created_at")
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(200);

    if (staleTxs) {
      for (const tx of staleTxs) {
        stats.checked++;
        stats.stale_pending++;

        // Check if already reconciled
        const { data: existing } = await supabase
          .from("reconciliation_checks")
          .select("id")
          .eq("transaction_id", tx.id)
          .eq("mismatch_type", "stale_pending")
          .eq("resolved", false)
          .maybeSingle();

        if (existing) continue;

        await supabase.from("reconciliation_checks").insert({
          transaction_id: tx.id,
          provider_transaction_id: tx.provider_transaction_id,
          expected_status: "processing_or_paid",
          provider_status: "unknown",
          mismatch_type: "stale_pending",
          mismatch_detected: true,
          resolved: false,
          resolution_details: { age_minutes: Math.floor((Date.now() - new Date(tx.created_at).getTime()) / 60000) },
        });

        stats.mismatches_detected++;
      }
    }

    // ── 2. Detect duplicate provider_transaction_id ──
    const { data: dupes } = await supabase.rpc("find_duplicate_provider_txs");

    // If the RPC doesn't exist, we do it inline via a raw approach
    // We'll query paid transactions and check for duplicates in app code
    const { data: paidTxs } = await supabase
      .from("gateway_transactions")
      .select("id, merchant_id, provider_transaction_id, amount, status")
      .not("provider_transaction_id", "is", null)
      .in("status", ["paid", "processing"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (paidTxs) {
      const providerIdMap = new Map<string, typeof paidTxs>();
      for (const tx of paidTxs) {
        stats.checked++;
        const key = tx.provider_transaction_id!;
        if (!providerIdMap.has(key)) {
          providerIdMap.set(key, []);
        }
        providerIdMap.get(key)!.push(tx);
      }

      for (const [providerId, txGroup] of providerIdMap) {
        if (txGroup.length <= 1) continue;

        stats.duplicates_found++;

        // Check if already flagged
        const { data: existingDupe } = await supabase
          .from("reconciliation_checks")
          .select("id")
          .eq("provider_transaction_id", providerId)
          .eq("mismatch_type", "duplicate_provider_id")
          .eq("resolved", false)
          .maybeSingle();

        if (existingDupe) continue;

        // Flag all but the first as duplicates
        for (let i = 1; i < txGroup.length; i++) {
          await supabase.from("reconciliation_checks").insert({
            transaction_id: txGroup[i].id,
            provider_transaction_id: providerId,
            expected_status: "unique",
            provider_status: "duplicate",
            mismatch_type: "duplicate_provider_id",
            mismatch_detected: true,
            resolved: false,
            resolution_details: {
              original_tx_id: txGroup[0].id,
              duplicate_count: txGroup.length,
            },
          });

          // Log security event
          await supabase.from("security_events").insert({
            event_type: "duplicate_payment" as any,
            merchant_id: txGroup[i].merchant_id,
            metadata: {
              provider_transaction_id: providerId,
              duplicate_tx_id: txGroup[i].id,
              original_tx_id: txGroup[0].id,
            },
          });
        }

        stats.critical_alerts++;
      }
    }

    // ── 3. Check webhook_events for confirmed payments not reflected in gateway ──
    const { data: unreflectedWebhooks } = await supabase
      .from("webhook_events")
      .select("id, transaction_id, payload, event_type, signature_valid")
      .eq("processed", true)
      .eq("signature_valid", true)
      .not("transaction_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (unreflectedWebhooks) {
      for (const wh of unreflectedWebhooks) {
        if (!wh.transaction_id) continue;
        stats.checked++;

        const whStatus = (wh.payload as any)?.status?.toLowerCase();
        if (!whStatus) continue;

        let expectedGwStatus: string | null = null;
        if (["paid", "approved", "completed"].includes(whStatus)) expectedGwStatus = "paid";
        else if (["failed", "rejected", "expired"].includes(whStatus)) expectedGwStatus = "failed";
        else if (whStatus === "refunded") expectedGwStatus = "refunded";

        if (!expectedGwStatus) continue;

        // Get current gateway status
        const { data: gwTx } = await supabase
          .from("gateway_transactions")
          .select("id, status, merchant_id, amount, provider_transaction_id")
          .eq("id", wh.transaction_id)
          .single();

        if (!gwTx || gwTx.status === expectedGwStatus) continue;

        // Mismatch detected!
        const { data: existingCheck } = await supabase
          .from("reconciliation_checks")
          .select("id")
          .eq("transaction_id", gwTx.id)
          .eq("mismatch_type", "status_mismatch")
          .eq("resolved", false)
          .maybeSingle();

        if (existingCheck) continue;

        stats.mismatches_detected++;

        // Try auto-resolve: if gateway is pending/processing and provider says paid
        const canAutoResolve =
          (gwTx.status === "pending" || gwTx.status === "processing") &&
          expectedGwStatus === "paid";

        if (canAutoResolve) {
          // Auto-correct via the secure RPC
          const { data: updated, error: updateErr } = await supabase.rpc("update_gateway_tx_status", {
            _tx_id: gwTx.id,
            _new_status: expectedGwStatus,
            _provider_tx_id: gwTx.provider_transaction_id || "",
          });

          if (!updateErr) {
            await supabase.from("reconciliation_checks").insert({
              transaction_id: gwTx.id,
              provider_transaction_id: gwTx.provider_transaction_id,
              expected_status: expectedGwStatus,
              provider_status: whStatus,
              mismatch_type: "status_mismatch",
              mismatch_detected: true,
              resolved: true,
              resolved_at: new Date().toISOString(),
              resolution_method: "auto",
              resolution_details: {
                previous_status: gwTx.status,
                new_status: expectedGwStatus,
                reason: "Provider confirmed payment, gateway was stale",
              },
            });

            await supabase.from("security_events").insert({
              event_type: "auto_reconciled" as any,
              merchant_id: gwTx.merchant_id,
              metadata: {
                transaction_id: gwTx.id,
                from_status: gwTx.status,
                to_status: expectedGwStatus,
                amount: gwTx.amount,
              },
            });

            stats.auto_resolved++;
          } else {
            // Could not auto-resolve, flag as critical
            await supabase.from("reconciliation_checks").insert({
              transaction_id: gwTx.id,
              provider_transaction_id: gwTx.provider_transaction_id,
              expected_status: expectedGwStatus,
              provider_status: whStatus,
              mismatch_type: "status_mismatch",
              mismatch_detected: true,
              resolved: false,
              resolution_details: {
                previous_status: gwTx.status,
                error: updateErr.message,
                reason: "Auto-resolve failed, requires manual review",
              },
            });

            await supabase.from("security_events").insert({
              event_type: "critical_financial_mismatch" as any,
              merchant_id: gwTx.merchant_id,
              metadata: {
                transaction_id: gwTx.id,
                gateway_status: gwTx.status,
                provider_status: expectedGwStatus,
                amount: gwTx.amount,
              },
            });

            stats.critical_alerts++;
          }
        } else {
          // Cannot auto-resolve — flag as critical
          await supabase.from("reconciliation_checks").insert({
            transaction_id: gwTx.id,
            provider_transaction_id: gwTx.provider_transaction_id,
            expected_status: expectedGwStatus,
            provider_status: whStatus,
            mismatch_type: "status_mismatch",
            mismatch_detected: true,
            resolved: false,
            resolution_details: {
              gateway_status: gwTx.status,
              provider_indicated: expectedGwStatus,
              reason: "Status transition not auto-resolvable",
            },
          });

          await supabase.from("security_events").insert({
            event_type: "critical_financial_mismatch" as any,
            merchant_id: gwTx.merchant_id,
            metadata: {
              transaction_id: gwTx.id,
              gateway_status: gwTx.status,
              provider_status: expectedGwStatus,
              amount: gwTx.amount,
            },
          });

          stats.critical_alerts++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Reconciliation error:", err);
    return new Response(JSON.stringify({ error: "Reconciliation failed", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
