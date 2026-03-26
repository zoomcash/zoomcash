import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link2, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Affiliates = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: referralCode } = useQuery({
    queryKey: ["referral-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .single();
      if (data) return data.code;
      const { data: newCode } = await supabase.rpc("generate_referral_code");
      if (newCode) {
        await supabase.from("referral_codes").insert({ user_id: user.id, code: newCode });
        return newCode as string;
      }
      return null;
    },
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ["affiliate-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("affiliate_settings").select("*").limit(1).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: commissions } = useQuery({
    queryKey: ["commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("referral_commissions")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: referrals } = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("referrals").select("*").eq("referrer_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const commPerTx = (settings as any)?.commission_per_transaction ?? 0.05;
  const bonusThreshold = (settings as any)?.bonus_threshold ?? 100;
  const bonusAmount = (settings as any)?.bonus_amount ?? 5.0;
  const totalEarned = commissions?.reduce((s, c) => s + c.commission_amount, 0) ?? 0;
  const totalTransactions = commissions?.length ?? 0;
  const totalReferred = referrals?.length ?? 0;
  const remaining = Math.max(0, bonusThreshold - (totalTransactions % bonusThreshold));

  const referralLink = referralCode ? `${window.location.origin}/auth?ref=${referralCode}` : "";

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 pt-16 md:pt-8 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Afiliados</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Ganhe <span className="text-primary font-semibold">R$ {commPerTx.toFixed(2).replace(".", ",")}</span> por transação + bônus
          </p>
        </div>

        {/* Referral Link */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Seu Link de Afiliado</span>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={referralLink} className="bg-secondary/50 font-mono-value text-[12px] h-9" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0 h-9 w-9">
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {referralCode && (
            <p className="text-[11px] text-muted-foreground">
              Código: <span className="font-mono-value font-semibold text-foreground">{referralCode}</span>
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Ganho", value: `R$ ${totalEarned.toFixed(2).replace(".", ",")}`, color: "text-emerald-400" },
            { label: "Transações", value: totalTransactions.toString(), color: "text-foreground" },
            { label: "Indicados", value: totalReferred.toString(), color: "text-primary" },
            { label: "Próximo Bônus", value: remaining.toString(), color: "text-primary" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
              <p className={`text-xl font-bold mt-1.5 font-mono-value ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Commissions + Referred */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-[13px] font-semibold text-foreground mb-3">Comissões Recentes</h2>
            {commissions && commissions.length > 0 ? (
              <div className="space-y-0">
                {commissions.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                    <span className="text-[12px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="text-[12px] font-bold text-emerald-400 font-mono-value">
                      +R$ {c.commission_amount.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-[12px] text-muted-foreground">Nenhuma comissão ainda</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-[13px] font-semibold text-foreground mb-3">Usuários Indicados</h2>
            {referrals && referrals.length > 0 ? (
              <div className="space-y-0">
                {referrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                    <span className="text-[12px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono-value">{r.referred_id.slice(0, 8)}...</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-[12px] text-muted-foreground">Nenhum indicado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Affiliates;
