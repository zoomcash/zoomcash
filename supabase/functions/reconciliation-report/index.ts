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

  try {
    // Auth check — only admins
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get totals
    const { count: totalChecks } = await supabase
      .from("reconciliation_checks")
      .select("*", { count: "exact", head: true });

    const { count: unresolvedCount } = await supabase
      .from("reconciliation_checks")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false);

    const { count: resolvedCount } = await supabase
      .from("reconciliation_checks")
      .select("*", { count: "exact", head: true })
      .eq("resolved", true);

    const { count: autoResolvedCount } = await supabase
      .from("reconciliation_checks")
      .select("*", { count: "exact", head: true })
      .eq("resolved", true)
      .eq("resolution_method", "auto");

    // Recent unresolved
    const { data: recentUnresolved } = await supabase
      .from("reconciliation_checks")
      .select("id, transaction_id, provider_transaction_id, expected_status, provider_status, mismatch_type, created_at, resolution_details")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(20);

    // By type breakdown
    const { data: allChecks } = await supabase
      .from("reconciliation_checks")
      .select("mismatch_type, resolved");

    const byType: Record<string, { total: number; resolved: number; unresolved: number }> = {};
    if (allChecks) {
      for (const c of allChecks) {
        if (!byType[c.mismatch_type]) byType[c.mismatch_type] = { total: 0, resolved: 0, unresolved: 0 };
        byType[c.mismatch_type].total++;
        if (c.resolved) byType[c.mismatch_type].resolved++;
        else byType[c.mismatch_type].unresolved++;
      }
    }

    return new Response(JSON.stringify({
      total_checks: totalChecks || 0,
      mismatches_detected: totalChecks || 0,
      resolved: resolvedCount || 0,
      auto_resolved: autoResolvedCount || 0,
      unresolved: unresolvedCount || 0,
      by_type: byType,
      recent_unresolved: recentUnresolved || [],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Report error:", err);
    return new Response(JSON.stringify({ error: "Report generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
