import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, Share2, Users, DollarSign, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Referral = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  // Fetch or create referral code
  const { data: referralCode, isLoading: codeLoading } = useQuery({
    queryKey: ["referral-code", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Try to get existing code
      const { data } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) return data.code;

      // Generate a new one
      const { data: codeData } = await supabase.rpc("generate_referral_code");
      const newCode = codeData as string;

      const { error } = await supabase
        .from("referral_codes")
        .insert({ user_id: user.id, code: newCode });

      if (error) {
        // Retry fetch in case of race condition
        const { data: retry } = await supabase
          .from("referral_codes")
          .select("code")
          .eq("user_id", user.id)
          .single();
        return retry?.code ?? newCode;
      }

      return newCode;
    },
    enabled: !!user,
  });

  // Fetch affiliate settings
  const { data: settings } = useQuery({
    queryKey: ["affiliate-settings"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("affiliate_settings").select("*").limit(1).single();
      return data ? {
        min_deposit: Number(data.min_deposit),
        level1: Number(data.level1_commission),
        level2: Number(data.level2_commission),
        level3: Number(data.level3_commission),
      } : { min_deposit: 30, level1: 10, level2: 5, level3: 2 };
    },
  });

  // Fetch referral stats with levels
  const { data: stats } = useQuery({
    queryKey: ["referral-stats", user?.id],
    queryFn: async () => {
      if (!user) return { totalReferred: 0, totalCommissions: 0, commissions: [], levels: { 1: { members: 0, bonus: 0 }, 2: { members: 0, bonus: 0 }, 3: { members: 0, bonus: 0 } } };

      const [referralsRes, commissionsRes] = await Promise.all([
        supabase
          .from("referrals")
          .select("id, referred_id, created_at")
          .eq("referrer_id", user.id),
        supabase
          .from("referral_commissions")
          .select("id, commission_amount, created_at, level")
          .eq("referrer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const directReferrals = referralsRes.data ?? [];
      const commissions = commissionsRes.data ?? [];
      const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);

      const levels: Record<number, { members: number; bonus: number }> = {
        1: { members: directReferrals.length, bonus: 0 },
        2: { members: 0, bonus: 0 },
        3: { members: 0, bonus: 0 },
      };

      commissions.forEach((c: any) => {
        const lvl = c.level || 1;
        if (levels[lvl]) {
          levels[lvl].bonus += Number(c.commission_amount);
        }
      });

      const level2Referred = new Set(commissions.filter((c: any) => c.level === 2).map((c: any) => c.id));
      const level3Referred = new Set(commissions.filter((c: any) => c.level === 3).map((c: any) => c.id));
      levels[2].members = level2Referred.size;
      levels[3].members = level3Referred.size;

      return { totalReferred: directReferrals.length, totalCommissions, commissions, levels };
    },
    enabled: !!user,
  });

  const referralLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (platform: string) => {
    const text = `Ganhe R$1.000 de bônus! Cadastre-se na PixRaspadinha: ${referralLink}`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(referralLink);

    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent("Ganhe R$1.000 de bônus na PixRaspadinha!")}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], "_blank");
    } else {
      // Generic share
      if (navigator.share) {
        await navigator.share({ title: "PixRaspadinha", text, url: referralLink });
      } else {
        handleCopy();
      }
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-6 rounded-xl border border-primary/30 bg-card p-6 text-center box-glow">
            <Gift className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h1 className="font-display text-2xl text-foreground mb-1">
              Convide e ganhe <span className="text-primary text-glow">R$ {settings?.level1 ?? 10}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Ganhe bônus em 3 níveis! Nível 1: R${settings?.level1 ?? 10}, Nível 2: R${settings?.level2 ?? 5}, Nível 3: R${settings?.level3 ?? 2} por depósito ≥ R${settings?.min_deposit ?? 30}.
            </p>
          </div>

          {/* Referral Link */}
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground mb-3">Seu link de convite</p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-secondary px-4 py-3 text-sm text-foreground/80 truncate font-mono">
                {codeLoading ? "Gerando..." : referralLink}
              </div>
              <Button
                onClick={handleCopy}
                variant="outline"
                className="shrink-0 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                disabled={codeLoading}
              >
                <Copy className="h-4 w-4 mr-1" />
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>

            {/* Share buttons */}
            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={() => handleShare("share")}
                className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
                  <Share2 className="h-5 w-5" />
                </div>
                Partilhar
              </button>
              <button
                onClick={() => handleShare("telegram")}
                className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0088cc]/20 text-[#0088cc]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </div>
                Telegram
              </button>
              <button
                onClick={() => handleShare("whatsapp")}
                className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366]/20 text-[#25D366]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                WhatsApp
              </button>
              <button
                onClick={() => handleShare("facebook")}
                className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1877F2]/20 text-[#1877F2]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                Facebook
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="font-display text-2xl text-foreground">{stats?.totalReferred ?? 0}</p>
              <p className="text-xs text-muted-foreground">Convidados Diretos</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="font-display text-2xl text-primary text-glow">
                R$ {(stats?.totalCommissions ?? 0).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Total de Bônus</p>
            </div>
          </div>

          {/* Level breakdown */}
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-lg text-foreground mb-4">Detalhes por Nível</h3>
            <Separator className="mb-4" />
            {[1, 2, 3].map((level) => {
              const lvl = stats?.levels?.[level] ?? { members: 0, bonus: 0 };
              const levelConfig = {
                1: { label: "Nível 1 (Direto)", color: "text-green-400", commission: `R$ ${settings?.level1 ?? 10}` },
                2: { label: "Nível 2", color: "text-blue-400", commission: `R$ ${settings?.level2 ?? 5}` },
                3: { label: "Nível 3", color: "text-purple-400", commission: `R$ ${settings?.level3 ?? 2}` },
              }[level]!;
              return (
                <div key={level} className="mb-4 last:mb-0">
                  <p className={`text-sm font-semibold ${levelConfig.color} mb-2`}>{levelConfig.label} — {levelConfig.commission}/depósito</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">Membros</p>
                      <p className="font-display text-lg text-foreground">{lvl.members}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs text-muted-foreground">Bônus Ganho</p>
                      <p className={`font-display text-lg ${levelConfig.color}`}>R$ {lvl.bonus.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-primary/10 p-3">
                <p className="text-xs text-muted-foreground">Total Membros (Nível 1-3)</p>
                <p className="font-display text-lg text-foreground">
                  {([1, 2, 3]).reduce((s, l) => s + (stats?.levels?.[l]?.members ?? 0), 0)}
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <p className="text-xs text-muted-foreground">Total Bônus (Nível 1-3)</p>
                <p className="font-display text-lg text-primary text-glow">
                  R$ {(stats?.totalCommissions ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Commission history */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-lg text-foreground mb-3">Histórico de Comissões</h3>
            <Separator className="mb-4" />
            {stats?.commissions && stats.commissions.length > 0 ? (
              <div className="space-y-2">
                {stats.commissions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-primary" />
                      <span className="text-sm text-foreground">Comissão de indicação</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">+R$ {Number(c.commission_amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma comissão ainda. Convide amigos para começar a ganhar!
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-lg text-foreground mb-3">Como funciona?</h3>
            <Separator className="mb-4" />
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                <p>Compartilhe seu link de convite com amigos</p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                <p>Seu amigo se cadastra usando o link</p>
              </div>
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
                <p>A cada depósito de <strong className="text-foreground">R$ {settings?.min_deposit ?? 30}</strong>:</p>
              </div>
              <div className="ml-10 space-y-1">
                <p>🟢 <strong className="text-green-400">Nível 1</strong> (indicação direta): <strong className="text-primary">R$ {settings?.level1 ?? 10}</strong></p>
                <p>🔵 <strong className="text-blue-400">Nível 2</strong> (indicação do seu indicado): <strong className="text-primary">R$ {settings?.level2 ?? 5}</strong></p>
                <p>🟣 <strong className="text-purple-400">Nível 3</strong> (3º nível na cadeia): <strong className="text-primary">R$ {settings?.level3 ?? 2}</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Referral;
