import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { AppLayout } from "@/components/layout/AppLayout";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import {
  subDays, startOfDay, startOfWeek, startOfMonth, startOfYear,
  format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft,
  Receipt, Activity, Send, Download, Eye, Lock,
  CreditCard, PercentCircle, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type DashPeriod = "today" | "yesterday" | "week" | "month" | "all";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashPeriod>("today");
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("year");

  useEffect(() => {
    if (!loading && !user) navigate("/auth?redirect=/dashboard");
  }, [user, loading, navigate]);

  const { data: allTransactions } = useQuery({
    queryKey: ["dashboard-transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["withdrawals-total", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("withdrawals")
        .select("amount, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "approved");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getPeriodStart = (p: DashPeriod): Date | null => {
    const now = new Date();
    switch (p) {
      case "today": return startOfDay(now);
      case "yesterday": return startOfDay(subDays(now, 1));
      case "week": return startOfWeek(now, { weekStartsOn: 1 });
      case "month": return startOfMonth(now);
      default: return null;
    }
  };

  const periodStart = getPeriodStart(period);

  const filteredTransactions = useMemo(() => {
    let arr = allTransactions || [];
    if (periodStart) {
      arr = arr.filter((t) => new Date(t.created_at) >= periodStart);
      if (period === "yesterday") {
        arr = arr.filter((t) => new Date(t.created_at) < startOfDay(new Date()));
      }
    }
    return arr;
  }, [allTransactions, period, periodStart]);

  const recentTransactions = useMemo(() => {
    return (allTransactions || []).slice(0, 5);
  }, [allTransactions]);

  const filteredWithdrawals = useMemo(() => {
    let arr = withdrawals || [];
    if (periodStart) {
      arr = arr.filter((w) => new Date(w.created_at) >= periodStart);
    }
    return arr;
  }, [withdrawals, periodStart, period]);

  const chartData = useMemo(() => {
    const now = new Date();
    const txs = allTransactions || [];
    if (chartPeriod === "week") {
      const start = subDays(now, 6);
      return eachDayOfInterval({ start, end: now }).map((d) => {
        const dayStr = format(d, "yyyy-MM-dd");
        const total = txs
          .filter((t) => t.type === "deposit" && format(new Date(t.created_at), "yyyy-MM-dd") === dayStr)
          .reduce((s, t) => s + t.amount, 0);
        return { label: format(d, "EEE", { locale: ptBR }), vendas: total };
      });
    }
    if (chartPeriod === "month") {
      const start = subDays(now, 29);
      const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
      return weeks.map((w, i) => {
        const wEnd = i < weeks.length - 1 ? weeks[i + 1] : now;
        const total = txs
          .filter((t) => { const d = new Date(t.created_at); return t.type === "deposit" && d >= w && d < wEnd; })
          .reduce((s, t) => s + t.amount, 0);
        return { label: `Sem ${i + 1}`, vendas: total };
      });
    }
    const start = startOfYear(now);
    return eachMonthOfInterval({ start, end: now }).map((m) => {
      const mStr = format(m, "yyyy-MM");
      const total = txs
        .filter((t) => t.type === "deposit" && format(new Date(t.created_at), "yyyy-MM") === mStr)
        .reduce((s, t) => s + t.amount, 0);
      return { label: format(m, "MMM", { locale: ptBR }), vendas: total };
    });
  }, [allTransactions, chartPeriod]);

  const totalWithdrawn = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const totalTransactions = filteredTransactions.length;
  const totalDeposits = filteredTransactions.filter((t) => t.type === "deposit").reduce((sum, t) => sum + t.amount, 0);
  const avgTicket = totalTransactions > 0 ? totalDeposits / totalTransactions : 0;
  const totalVolume = filteredTransactions.filter((t) => t.type === "deposit" || t.type === "win").reduce((sum, t) => sum + t.amount, 0);
  const approvedDeposits = filteredTransactions.filter((t) => t.type === "deposit").length;
  const conversionPct = totalTransactions > 0 ? ((approvedDeposits / totalTransactions) * 100) : 0;

  if (loading) return null;

  const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const stats = [
    { icon: Wallet, label: "Saldo disponível", value: fmtBRL(wallet?.balance ?? 0) },
    { icon: Lock, label: "Saldo bloqueado", value: fmtBRL(0) },
    { icon: TrendingUp, label: "Volume transacionado", value: fmtBRL(totalVolume) },
    { icon: Activity, label: "Ticket Médio", value: fmtBRL(avgTicket) },
    { icon: Receipt, label: "Total de transações", value: String(totalTransactions) },
    { icon: CreditCard, label: "Descontos em Taxas", value: fmtBRL(0) },
    { icon: ArrowUpRight, label: "Total Retirado", value: fmtBRL(totalWithdrawn) },
    { icon: PercentCircle, label: "Conversão PIX", value: `${conversionPct.toFixed(1)}%`, sub: `${approvedDeposits}/${totalTransactions} aprovados` },
  ];

  // Payment methods breakdown
  const paymentMethods = [
    { name: "PIX", pct: 100, count: totalTransactions, color: "hsl(var(--primary))" },
    { name: "BOLETO", pct: 0, count: 0, color: "hsl(var(--muted-foreground))" },
    { name: "CARTÃO", pct: 0, count: 0, color: "hsl(var(--muted-foreground))" },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 pt-16 md:pt-8 space-y-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-border bg-card p-5 flex items-center justify-between"
        >
          <div>
            <h1 className="text-lg font-extrabold text-foreground tracking-tight">Resumo</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {greeting()}. É um prazer tê-lo de volta.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as DashPeriod)}>
              <SelectTrigger className="w-[130px] h-9 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid - 4 columns */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] text-muted-foreground font-medium">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="text-xl font-extrabold text-foreground font-mono-value leading-none">
                {stat.value}
              </p>
              {stat.sub && (
                <p className="text-[11px] text-muted-foreground mt-1.5">{stat.sub}</p>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Sales Chart - Full Width */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-sm font-bold text-foreground">Análise de Vendas</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">Visualize o desempenho das suas vendas</p>
            </div>
            <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
              {(["week", "month", "year"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`px-4 py-1.5 text-[12px] font-semibold rounded-md transition-all ${
                    chartPeriod === p
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {p === "week" ? "Semana" : p === "month" ? "Mês" : "Ano"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[280px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    fontSize: "12px",
                    padding: "10px 14px",
                  }}
                  formatter={(value: number) => [fmtBRL(value), "Vendas"]}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700, marginBottom: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                  dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bottom: Recent Transactions + Payment Methods */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-5 gap-4"
        >
          {/* Recent Transactions */}
          <motion.div variants={fadeUp} className="lg:col-span-3 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Transações Recentes</h2>
                  <p className="text-[11px] text-muted-foreground">Últimas {recentTransactions.length} transações realizadas</p>
                </div>
              </div>
              <Link to="/extrato">
                <Button variant="outline" size="sm" className="h-8 text-[11px] border-border font-semibold">
                  Ver todas
                </Button>
              </Link>
            </div>

            <div className="px-5 pb-4">
              {recentTransactions.length === 0 && (
                <p className="py-10 text-center text-[13px] text-muted-foreground">
                  Nenhuma transação ainda
                </p>
              )}
              {recentTransactions.map((tx, i) => {
                const isPositive = tx.type === "deposit" || tx.type === "win" || tx.type === "bonus";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3.5 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${isPositive ? "bg-primary/10" : "bg-destructive/10"}`}>
                        {isPositive
                          ? <ArrowDownLeft className="h-4 w-4 text-primary" />
                          : <ArrowUpRight className="h-4 w-4 text-destructive" />
                        }
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground leading-tight">
                          {tx.description || tx.type}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(tx.created_at).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[13px] font-bold font-mono-value ${isPositive ? "text-primary" : "text-destructive"}`}>
                      {isPositive ? "+" : "-"}{fmtBRL(Math.abs(tx.amount))}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Payment Methods */}
          <motion.div variants={fadeUp} className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Métodos de Pagamento</h2>
                <p className="text-[11px] text-muted-foreground">Distribuição por método de pagamento</p>
              </div>
            </div>

            <div className="space-y-5">
              {paymentMethods.map((method) => (
                <div key={method.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded bg-secondary p-1">
                        {method.name === "PIX" ? (
                          <Copy className="h-3.5 w-3.5 text-primary" />
                        ) : method.name === "BOLETO" ? (
                          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-[13px] font-bold text-foreground">{method.name}</span>
                    </div>
                    <span className="text-[13px] font-bold text-foreground font-mono-value">{method.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${method.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: method.color }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{method.count} transações</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
