import { useEffect, useState, useCallback } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useAdminApi } from "@/hooks/useAdminApi";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Users, DollarSign, Wallet, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Gift, Link2, Save,
  Shield, Activity, AlertTriangle, CreditCard, Store,
  RefreshCw, Heart, Webhook, Clock, Ban, Check, FlaskConical,
} from "lucide-react";
import { GatewayTests } from "@/components/admin/GatewayTests";
import { SystemMonitoring } from "@/components/admin/SystemMonitoring";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Pagination, paginate } from "@/components/admin/Pagination";

interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalGwTransactions: number;
  totalGwVolume: number;
  totalWalletBalance: number;
  netFlow: number;
}

interface UserRow {
  user_id: string;
  display_name: string | null;
  created_at: string;
  balance: number;
  totalDeposit: number;
  totalWithdrawal: number;
}

const TABS = [
  "Dashboard", "Usuários", "Transações", "Saques", "Afiliados", "Taxas",
  "Health", "Merchants", "Payment Intents", "Transações GW", "Fraud",
  "Segurança", "Auditoria", "Reconciliação", "Webhooks", "Testes", "Monitoramento",
] as const;
type Tab = (typeof TABS)[number];

const PLATFORM_TABS: Tab[] = ["Dashboard", "Usuários", "Transações", "Saques", "Afiliados", "Taxas"];
const GATEWAY_TABS: Tab[] = ["Health", "Merchants", "Payment Intents", "Transações GW", "Fraud", "Segurança", "Auditoria", "Reconciliação", "Webhooks", "Testes", "Monitoramento"];

const fmt = (v: number | null | undefined) =>
  `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Admin = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { call, loading: apiLoading } = useAdminApi();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("Dashboard");

  // Platform state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalProfiles, setWithdrawalProfiles] = useState<Record<string, string>>({});
  const [affiliateData, setAffiliateData] = useState<{
    referrals: any[]; commissions: any[]; profileMap: Record<string, string>;
    totalCommissionsPaid: number; totalReferrals: number;
  }>({ referrals: [], commissions: [], profileMap: {}, totalCommissionsPaid: 0, totalReferrals: 0 });
  const [affiliateSettings, setAffiliateSettings] = useState({
    min_deposit: 30, level1_commission: 10, level2_commission: 5, level3_commission: 2,
    commission_per_transaction: 0.05, bonus_amount: 5, bonus_threshold: 100,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Fees state
  const [fees, setFees] = useState({
    pix_fee_fixed: 0.35, pix_fee_percent: 0.60,
    withdrawal_fee_fixed: 1.50, withdrawal_fee_percent: 0,
  });
  const [savingFees, setSavingFees] = useState(false);

  // Gateway state
  const [gwData, setGwData] = useState<any>(null);
  const [gwLoading, setGwLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const resetPage = () => setPage(1);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/dashboard");
  }, [isAdmin, adminLoading, navigate]);

  // Fetch platform data
  const fetchPlatform = useCallback(async () => {
    if (!isAdmin || !user) return;
    try {
      const [{ data: profiles }, { data: wallets }, { data: transactions }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, created_at"),
        supabase.from("wallets").select("user_id, balance"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      ]);

      const totalUsers = profiles?.length || 0;
      const totalDeposits = (transactions || []).filter((t: any) => t.type === "deposit" || t.type === "bonus").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalWithdrawals = (transactions || []).filter((t: any) => t.type === "withdrawal").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalWalletBalance = (wallets || []).reduce((s: number, w: any) => s + Number(w.balance), 0);

      // Fetch gateway transaction stats
      const { data: gwTxs } = await supabase.from("gateway_transactions").select("amount, status");
      const totalGwTransactions = gwTxs?.length || 0;
      const totalGwVolume = (gwTxs || []).filter((t: any) => t.status === "paid").reduce((s: number, t: any) => s + Number(t.amount), 0);

      setStats({ totalUsers, totalDeposits, totalWithdrawals, totalGwTransactions, totalGwVolume, totalWalletBalance, netFlow: totalDeposits - totalWithdrawals });

      const userMap: Record<string, UserRow> = {};
      (profiles || []).forEach((p: any) => {
        userMap[p.user_id] = { user_id: p.user_id, display_name: p.display_name, created_at: p.created_at, balance: 0, totalDeposit: 0, totalWithdrawal: 0 };
      });
      (wallets || []).forEach((w: any) => { if (userMap[w.user_id]) userMap[w.user_id].balance = Number(w.balance); });
      (transactions || []).forEach((t: any) => {
        if (!userMap[t.user_id]) return;
        if (t.type === "deposit" || t.type === "bonus") userMap[t.user_id].totalDeposit += Number(t.amount);
        if (t.type === "withdrawal") userMap[t.user_id].totalWithdrawal += Number(t.amount);
      });
      setUsers(Object.values(userMap).sort((a, b) => b.totalDeposit - a.totalDeposit));
      setRecentTx((transactions || []).slice(0, 30));

      const { data: wds } = await (supabase.from as any)("withdrawals").select("*").order("created_at", { ascending: false });
      setWithdrawals(wds || []);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.display_name || "Sem nome"; });
      setWithdrawalProfiles(nameMap);

      const [{ data: allReferrals }, { data: allCommissions }, { data: affSettings }] = await Promise.all([
        (supabase.from as any)("referrals").select("*").order("created_at", { ascending: false }),
        (supabase.from as any)("referral_commissions").select("*").order("created_at", { ascending: false }),
        (supabase.from as any)("affiliate_settings").select("*").limit(1).single(),
      ]);
      if (affSettings) {
        setAffiliateSettings({
          min_deposit: Number(affSettings.min_deposit),
          level1_commission: Number(affSettings.level1_commission),
          level2_commission: Number(affSettings.level2_commission),
          level3_commission: Number(affSettings.level3_commission),
          commission_per_transaction: Number(affSettings.commission_per_transaction),
          bonus_amount: Number(affSettings.bonus_amount),
          bonus_threshold: Number(affSettings.bonus_threshold),
        });
      }
      setAffiliateData({
        referrals: allReferrals || [], commissions: allCommissions || [], profileMap: nameMap,
        totalCommissionsPaid: (allCommissions || []).reduce((s: number, c: any) => s + Number(c.commission_amount), 0),
        totalReferrals: (allReferrals || []).length,
      });

      // Fetch platform fees
      const { data: feesData } = await supabase.from("platform_fees").select("*").limit(1).single();
      if (feesData) {
        setFees({
          pix_fee_fixed: Number(feesData.pix_fee_fixed),
          pix_fee_percent: Number(feesData.pix_fee_percent),
          withdrawal_fee_fixed: Number(feesData.withdrawal_fee_fixed),
          withdrawal_fee_percent: Number(feesData.withdrawal_fee_percent),
        });
      }
    } catch (e) {
      console.error("Admin fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => { fetchPlatform(); }, [fetchPlatform]);

  // Fetch gateway data based on active tab
  const fetchGateway = useCallback(async () => {
    if (!isAdmin || !GATEWAY_TABS.includes(tab as any) || tab === "Testes" || tab === "Monitoramento") return;
    setGwLoading(true);
    try {
      const endpoints: Record<string, string> = {
        Health: "system-health", Merchants: "merchants", "Payment Intents": "payment-intents",
        "Transações GW": "gateway-transactions", Fraud: "fraud-scores", Segurança: "security-events",
        Auditoria: "audit-log", Reconciliação: "reconciliation", Webhooks: "webhook-deliveries",
      };
      const result = await call(endpoints[tab]);
      setGwData(result);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGwLoading(false);
    }
  }, [isAdmin, tab, call]);

  useEffect(() => {
    if (GATEWAY_TABS.includes(tab as any)) fetchGateway();
  }, [tab, fetchGateway]);

  const handleWithdrawal = async (id: string, action: "approved" | "rejected") => {
    try {
      const { error } = await (supabase.rpc as any)("admin_process_withdrawal", { _withdrawal_id: id, _action: action, _admin_note: null });
      if (error) throw error;
      toast.success(action === "approved" ? "Saque aprovado!" : "Saque rejeitado!");
      fetchPlatform();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const handleMerchantAction = async (merchantId: string, action: "suspend" | "activate") => {
    try {
      await call(`merchants/${merchantId}/${action}`, "POST");
      toast.success(action === "suspend" ? "Merchant suspenso" : "Merchant ativado");
      fetchGateway();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (adminLoading || (isAdmin && loading)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground animate-pulse">Carregando painel...</p>
        </div>
      </AppLayout>
    );
  }
  if (!isAdmin) return null;

  const isGatewayTab = GATEWAY_TABS.includes(tab as any);

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          {isGatewayTab && (
            <Button variant="ghost" size="sm" onClick={fetchGateway} className="gap-1">
              <RefreshCw className={`h-4 w-4 ${apiLoading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          )}
        </div>

        {/* Section labels + tabs */}
        <div className="space-y-3 mb-6">
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Plataforma</p>
            <div className="flex gap-1.5 flex-wrap">
              {PLATFORM_TABS.map((t) => (
                <button key={t} onClick={() => { setTab(t); resetPage(); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Gateway</p>
            <div className="flex gap-1.5 flex-wrap">
              {GATEWAY_TABS.map((t) => (
                <button key={t} onClick={() => { setTab(t); resetPage(); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border hover:border-primary/50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== DASHBOARD ===== */}
        {tab === "Dashboard" && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Usuários", value: stats.totalUsers, icon: Users, format: "number" as const, color: "text-blue-400" },
              { label: "Depósitos + Bônus", value: stats.totalDeposits, icon: DollarSign, format: "currency" as const, color: "text-primary" },
              { label: "Saques", value: stats.totalWithdrawals, icon: TrendingDown, format: "currency" as const, color: "text-destructive" },
              { label: "Saldo em Carteiras", value: stats.totalWalletBalance, icon: Wallet, format: "currency" as const, color: "text-purple-400" },
              { label: "Fluxo Líquido", value: stats.netFlow, icon: stats.netFlow >= 0 ? TrendingUp : TrendingDown, format: "currency" as const, color: stats.netFlow >= 0 ? "text-primary" : "text-destructive" },
              { label: "Transações GW", value: stats.totalGwTransactions, icon: CreditCard, format: "number" as const, color: "text-yellow-400" },
              { label: "Volume GW (Pago)", value: stats.totalGwVolume, icon: Activity, format: "currency" as const, color: "text-primary" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{s.format === "currency" ? fmt(s.value) : s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ===== USUÁRIOS ===== */}
        {tab === "Usuários" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border"><h2 className="text-lg font-semibold text-foreground">Usuários ({users.length})</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
<thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Usuário</th><th className="p-3">Registro</th><th className="p-3 text-right">Saldo</th><th className="p-3 text-right">Depósitos</th><th className="p-3 text-right">Saques</th><th className="p-3 text-right">Fluxo</th></tr></thead>
                <tbody>
                  {paginate(users, page).map((u) => (
                    <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-foreground">{u.display_name || "Sem nome"}</td>
                      <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-right text-primary font-semibold">{fmt(u.balance)}</td>
                      <td className="p-3 text-right text-primary">{fmt(u.totalDeposit)}</td>
                      <td className="p-3 text-right text-destructive">{fmt(u.totalWithdrawal)}</td>
                      <td className={`p-3 text-right font-semibold ${u.totalDeposit - u.totalWithdrawal >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(u.totalDeposit - u.totalWithdrawal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={users.length} onPageChange={setPage} />
          </div>
        )}

        {/* ===== TRANSAÇÕES ===== */}
        {tab === "Transações" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border"><h2 className="text-lg font-semibold text-foreground">Últimas Transações</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Tipo</th><th className="p-3">Descrição</th><th className="p-3 text-right">Valor</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(recentTx, page).map((tx: any) => (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tx.type === "win" ? "bg-yellow-500/20 text-yellow-400" : tx.type === "bet" ? "bg-destructive/20 text-destructive" : tx.type === "bonus" ? "bg-purple-500/20 text-purple-400" : "bg-primary/20 text-primary"}`}>{tx.type}</span>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</td>
                      <td className="p-3 text-right font-semibold text-foreground">{fmt(Number(tx.amount))}</td>
                      <td className="p-3 text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={recentTx.length} onPageChange={setPage} />
          </div>
        )}

        {/* ===== SAQUES ===== */}
        {tab === "Saques" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Solicitações de Saque ({withdrawals.filter((w: any) => w.status === "pending").length} pendentes)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Usuário</th><th className="p-3">Chave PIX</th><th className="p-3 text-right">Valor</th><th className="p-3">Status</th><th className="p-3">Data</th><th className="p-3 text-right">Ações</th></tr></thead>
                <tbody>
                  {paginate(withdrawals, page).map((w: any) => (
                    <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-foreground">{withdrawalProfiles[w.user_id] || "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs font-mono">{w.pix_key}</td>
                      <td className="p-3 text-right font-semibold text-foreground">{fmt(Number(w.amount))}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${w.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : w.status === "approved" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                          {w.status === "pending" ? "Pendente" : w.status === "approved" ? "Aprovado" : "Rejeitado"}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3 text-right">
                        {w.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => handleWithdrawal(w.id, "approved")} className="text-primary hover:text-primary hover:bg-primary/10 gap-1"><CheckCircle2 className="h-4 w-4" /> Aprovar</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleWithdrawal(w.id, "rejected")} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"><XCircle className="h-4 w-4" /> Rejeitar</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma solicitação de saque</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={withdrawals.length} onPageChange={setPage} />
          </div>
        )}

        {/* ===== AFILIADOS ===== */}
        {tab === "Afiliados" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-primary/30 bg-card p-5">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><Save className="h-5 w-5 text-primary" /> Configurar Comissões</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Depósito Mínimo (R$)", key: "min_deposit", step: 1 },
                  { label: "Comissão por Transação (R$)", key: "commission_per_transaction", step: 0.01 },
                  { label: "Bônus (R$)", key: "bonus_amount", step: 0.5 },
                  { label: "Meta p/ Bônus (qtd)", key: "bonus_threshold", step: 1 },
                  { label: "Nível 1 (R$)", key: "level1_commission", step: 0.5 },
                  { label: "Nível 2 (R$)", key: "level2_commission", step: 0.5 },
                  { label: "Nível 3 (R$)", key: "level3_commission", step: 0.5 },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs text-muted-foreground">{f.label}</label>
                    <input type="number" step={f.step} className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground" value={(affiliateSettings as any)[f.key]} onChange={(e) => setAffiliateSettings((s) => ({ ...s, [f.key]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <Button disabled={savingSettings} onClick={async () => {
                setSavingSettings(true);
                try {
                  const { error } = await (supabase.from as any)("affiliate_settings").update({ ...affiliateSettings, updated_at: new Date().toISOString() }).neq("id", "00000000-0000-0000-0000-000000000000");
                  if (error) throw error;
                  toast.success("Configurações salvas!");
                } catch (e: any) { toast.error("Erro: " + e.message); } finally { setSavingSettings(false); }
              }} className="gap-2"><Save className="h-4 w-4" /> {savingSettings ? "Salvando..." : "Salvar"}</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 mb-2"><Link2 className="h-5 w-5 text-blue-400" /><span className="text-xs text-muted-foreground">Total Indicações</span></div><p className="text-xl font-bold text-foreground">{affiliateData.totalReferrals}</p></div>
              <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 mb-2"><Gift className="h-5 w-5 text-purple-400" /><span className="text-xs text-muted-foreground">Comissões Pagas</span></div><p className="text-xl font-bold text-foreground">{fmt(affiliateData.totalCommissionsPaid)}</p></div>
              <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 mb-2"><Users className="h-5 w-5 text-primary" /><span className="text-xs text-muted-foreground">Total Comissões</span></div><p className="text-xl font-bold text-foreground">{affiliateData.commissions.length}</p></div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border"><h2 className="text-lg font-semibold text-foreground">Indicações ({affiliateData.referrals.length})</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Indicador</th><th className="p-3">Indicado</th><th className="p-3">Data</th></tr></thead>
                  <tbody>
                    {affiliateData.referrals.map((r: any) => (<tr key={r.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3 font-medium text-foreground">{affiliateData.profileMap[r.referrer_id] || r.referrer_id.slice(0, 8)}</td><td className="p-3 text-muted-foreground">{affiliateData.profileMap[r.referred_id] || r.referred_id.slice(0, 8)}</td><td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td></tr>))}
                    {affiliateData.referrals.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nenhuma indicação</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border"><h2 className="text-lg font-semibold text-foreground">Comissões Pagas ({affiliateData.commissions.length})</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Beneficiário</th><th className="p-3">Origem</th><th className="p-3">Nível</th><th className="p-3 text-right">Valor</th><th className="p-3">Data</th></tr></thead>
                  <tbody>
                    {affiliateData.commissions.map((c: any) => (<tr key={c.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3 font-medium text-foreground">{affiliateData.profileMap[c.referrer_id] || c.referrer_id.slice(0, 8)}</td><td className="p-3 text-muted-foreground">{affiliateData.profileMap[c.referred_id] || c.referred_id.slice(0, 8)}</td><td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.level === 1 ? "bg-primary/20 text-primary" : c.level === 2 ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>Nível {c.level}</span></td><td className="p-3 text-right font-semibold text-primary">{fmt(Number(c.commission_amount))}</td><td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</td></tr>))}
                    {affiliateData.commissions.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhuma comissão</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAXAS ===== */}
        {tab === "Taxas" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-primary/30 bg-card p-5">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Taxas da Plataforma</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Taxa PIX Fixa (R$)", key: "pix_fee_fixed", step: 0.01 },
                  { label: "Taxa PIX (%)", key: "pix_fee_percent", step: 0.01 },
                  { label: "Taxa Saque Fixa (R$)", key: "withdrawal_fee_fixed", step: 0.01 },
                  { label: "Taxa Saque (%)", key: "withdrawal_fee_percent", step: 0.01 },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs text-muted-foreground">{f.label}</label>
                    <input type="number" step={f.step} className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground" value={(fees as any)[f.key]} onChange={(e) => setFees((s) => ({ ...s, [f.key]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <Button disabled={savingFees} onClick={async () => {
                setSavingFees(true);
                try {
                  const { error } = await supabase.from("platform_fees").update({ ...fees, updated_at: new Date().toISOString() }).neq("id", "00000000-0000-0000-0000-000000000000");
                  if (error) throw error;
                  toast.success("Taxas salvas!");
                } catch (e: any) { toast.error("Erro: " + e.message); } finally { setSavingFees(false); }
              }} className="gap-2"><Save className="h-4 w-4" /> {savingFees ? "Salvando..." : "Salvar"}</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Depósito PIX</h3>
                <p className="text-muted-foreground text-sm">Para cada depósito via PIX, cobra-se <span className="text-primary font-semibold">{fmt(fees.pix_fee_fixed)}</span> fixo + <span className="text-primary font-semibold">{fees.pix_fee_percent}%</span> do valor.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Saque</h3>
                <p className="text-muted-foreground text-sm">Para cada saque, cobra-se <span className="text-primary font-semibold">{fmt(fees.withdrawal_fee_fixed)}</span> fixo + <span className="text-primary font-semibold">{fees.withdrawal_fee_percent}%</span> do valor.</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== GATEWAY TABS ===== */}
        {isGatewayTab && gwLoading && (
          <div className="flex items-center justify-center py-20"><p className="text-muted-foreground animate-pulse">Carregando dados...</p></div>
        )}

        {/* HEALTH */}
        {tab === "Health" && !gwLoading && gwData?.alerts && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { label: "Tx Pendentes", value: gwData.alerts.pending_transactions, icon: Clock, warn: gwData.alerts.pending_transactions > 10 },
                { label: "Tx Stale (>30min)", value: gwData.alerts.stale_pending, icon: AlertTriangle, warn: gwData.alerts.stale_pending > 0 },
                { label: "Pagas (24h)", value: gwData.alerts.paid_transactions_24h, icon: Check, warn: false },
                { label: "Falhas (24h)", value: gwData.alerts.failed_transactions_24h, icon: Ban, warn: gwData.alerts.failed_transactions_24h > 5 },
                { label: "Webhooks Falhando", value: gwData.alerts.failed_webhook_deliveries, icon: Webhook, warn: gwData.alerts.failed_webhook_deliveries > 0 },
                { label: "Fila Pendente", value: gwData.alerts.pending_queue_items, icon: Activity, warn: gwData.alerts.pending_queue_items > 20 },
                { label: "Reconciliação", value: gwData.alerts.unresolved_reconciliation, icon: RefreshCw, warn: gwData.alerts.unresolved_reconciliation > 0 },
                { label: "Alertas Fraude (24h)", value: gwData.alerts.high_risk_alerts_24h, icon: Shield, warn: gwData.alerts.high_risk_alerts_24h > 0 },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.warn ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}>
                  <div className="flex items-center gap-2 mb-2"><s.icon className={`h-5 w-5 ${s.warn ? "text-destructive" : "text-muted-foreground"}`} /><span className="text-xs text-muted-foreground">{s.label}</span></div>
                  <p className={`text-2xl font-bold ${s.warn ? "text-destructive" : "text-foreground"}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Banco de Dados</h3>
                <p className="text-primary font-semibold">{gwData.database?.status || "healthy"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-blue-400" /> Providers</h3>
                {gwData.providers && Object.entries(gwData.providers).map(([name, info]: any) => (
                  <div key={name} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${info.configured ? "bg-primary" : "bg-destructive"}`} /><span className="text-sm text-foreground">{name}</span><span className="text-xs text-muted-foreground">{info.configured ? "Configurado" : "Não configurado"}</span></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MERCHANTS */}
        {tab === "Merchants" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Nome</th><th className="p-3">Prefixo API</th><th className="p-3">Status</th><th className="p-3">Rate Limit</th><th className="p-3">Criado</th><th className="p-3 text-right">Ações</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((m: any) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{m.name}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{m.api_key_prefix}****</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.status === "active" ? "bg-primary/20 text-primary" : m.status === "suspended" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"}`}>{m.status}</span></td>
                      <td className="p-3 text-muted-foreground">{m.rate_limit_per_minute}/min</td>
                      <td className="p-3 text-muted-foreground">{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-right">
                        {m.status === "active" ? (
                          <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => handleMerchantAction(m.id, "suspend")}><Ban className="h-3 w-3 mr-1" /> Suspender</Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-primary text-xs" onClick={() => handleMerchantAction(m.id, "activate")}><Check className="h-3 w-3 mr-1" /> Ativar</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum merchant</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* PAYMENT INTENTS */}
        {tab === "Payment Intents" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">ID</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Método</th><th className="p-3">Provider</th><th className="p-3">Risco</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((pi: any) => (
                    <tr key={pi.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{pi.id.slice(0, 8)}...</td>
                      <td className="p-3 font-semibold text-foreground">{fmt(pi.amount)}</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pi.status === "succeeded" ? "bg-primary/20 text-primary" : pi.status === "failed" ? "bg-destructive/20 text-destructive" : pi.status === "processing" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>{pi.status}</span></td>
                      <td className="p-3 text-muted-foreground">{pi.payment_method}</td>
                      <td className="p-3 text-muted-foreground">{pi.provider}</td>
                      <td className="p-3"><span className={`font-semibold ${pi.risk_score >= 70 ? "text-destructive" : pi.risk_score >= 40 ? "text-yellow-400" : "text-primary"}`}>{pi.risk_score}</span></td>
                      <td className="p-3 text-muted-foreground">{new Date(pi.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum payment intent</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* TRANSAÇÕES GW */}
        {tab === "Transações GW" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">ID</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3">Método</th><th className="p-3">Provider TX</th><th className="p-3">Risco</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((tx: any) => (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{tx.id.slice(0, 8)}...</td>
                      <td className="p-3 font-semibold text-foreground">{fmt(tx.amount)}</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tx.status === "paid" ? "bg-primary/20 text-primary" : tx.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"}`}>{tx.status}</span></td>
                      <td className="p-3 text-muted-foreground">{tx.payment_method}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{tx.provider_transaction_id || "—"}</td>
                      <td className="p-3"><span className={`font-semibold ${tx.risk_score >= 70 ? "text-destructive" : "text-primary"}`}>{tx.risk_score}</span></td>
                      <td className="p-3 text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma transação</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* FRAUD */}
        {tab === "Fraud" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">TX/PI</th><th className="p-3">Score</th><th className="p-3">Decisão</th><th className="p-3">Flags</th><th className="p-3">IP</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((f: any) => (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{(f.transaction_id || f.payment_intent_id || "—").slice(0, 8)}...</td>
                      <td className="p-3"><span className={`font-bold text-lg ${f.risk_score >= 70 ? "text-destructive" : f.risk_score >= 40 ? "text-yellow-400" : "text-primary"}`}>{f.risk_score}</span></td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.decision === "block" ? "bg-destructive/20 text-destructive" : f.decision === "review" ? "bg-yellow-500/20 text-yellow-400" : "bg-primary/20 text-primary"}`}>{f.decision}</span></td>
                      <td className="p-3"><div className="flex flex-wrap gap-1">{(f.flags || []).map((flag: string, i: number) => (<span key={i} className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{flag}</span>))}{(!f.flags || f.flags.length === 0) && <span className="text-muted-foreground text-xs">—</span>}</div></td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{f.ip_address || "—"}</td>
                      <td className="p-3 text-muted-foreground">{new Date(f.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum registro</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* SEGURANÇA */}
        {tab === "Segurança" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Tipo</th><th className="p-3">Merchant</th><th className="p-3">IP</th><th className="p-3">Detalhes</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((e: any) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.event_type.includes("unauthorized") || e.event_type.includes("invalid") ? "bg-destructive/20 text-destructive" : e.event_type.includes("rate_limit") ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>{e.event_type}</span></td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{e.merchant_id?.slice(0, 8) || "—"}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{e.ip_address || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{e.metadata ? JSON.stringify(e.metadata).slice(0, 80) : "—"}</td>
                      <td className="p-3 text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum evento</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* AUDITORIA */}
        {tab === "Auditoria" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Ação</th><th className="p-3">Entidade</th><th className="p-3">Ator</th><th className="p-3">IP</th><th className="p-3">Detalhes</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((a: any) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{a.action}</td>
                      <td className="p-3 text-xs text-muted-foreground">{a.entity_type} / {a.entity_id?.slice(0, 8)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{a.actor_type}: {a.actor_id?.slice(0, 8) || "—"}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{a.ip_address || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{a.metadata ? JSON.stringify(a.metadata).slice(0, 80) : "—"}</td>
                      <td className="p-3 text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum log</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* RECONCILIAÇÃO */}
        {tab === "Reconciliação" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">TX</th><th className="p-3">Tipo</th><th className="p-3">Esperado</th><th className="p-3">Provider</th><th className="p-3">Resolvido</th><th className="p-3">Método</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((r: any) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{r.transaction_id?.slice(0, 8)}...</td>
                      <td className="p-3"><span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-500/20 text-orange-400">{r.mismatch_type}</span></td>
                      <td className="p-3 text-muted-foreground">{r.expected_status}</td>
                      <td className="p-3 text-muted-foreground">{r.provider_status || "—"}</td>
                      <td className="p-3">{r.resolved ? <span className="text-primary text-xs font-semibold">✓ Sim</span> : <span className="text-destructive text-xs font-semibold">✗ Não</span>}</td>
                      <td className="p-3 text-xs text-muted-foreground">{r.resolution_method || "—"}</td>
                      <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma inconsistência</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* WEBHOOKS */}
        {tab === "Webhooks" && !gwLoading && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">TX</th><th className="p-3">Evento</th><th className="p-3">Status</th><th className="p-3">Tentativas</th><th className="p-3">Erro</th><th className="p-3">Data</th></tr></thead>
                <tbody>
                  {paginate(gwData?.data || [], page).map((w: any) => (
                    <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{w.transaction_id?.slice(0, 8)}...</td>
                      <td className="p-3 font-medium text-foreground">{w.event_type}</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${w.status === "sent" ? "bg-primary/20 text-primary" : w.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"}`}>{w.status}</span></td>
                      <td className="p-3 text-muted-foreground">{w.attempts}</td>
                      <td className="p-3 text-xs text-destructive max-w-[200px] truncate">{w.last_error || "—"}</td>
                      <td className="p-3 text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {(!gwData?.data || gwData.data.length === 0) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma entrega</td></tr>}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={(gwData?.data || []).length} onPageChange={setPage} />
          </div>
        )}

        {/* ===== TESTES ===== */}
        {tab === "Testes" && <GatewayTests />}

        {/* ===== MONITORAMENTO ===== */}
        {tab === "Monitoramento" && <SystemMonitoring />}
      </div>
    </AppLayout>
  );
};

export default Admin;
