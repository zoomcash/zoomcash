import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Wallet, ArrowUpFromLine, CheckCircle2,
  Loader2, Banknote, Key, Clock, XCircle, RefreshCw, Info,
} from "lucide-react";

const MIN_WITHDRAW = 2;

const validatePixKey = (key: string): boolean => {
  const cleaned = key.trim();
  return cleaned.length >= 3 && cleaned.length <= 300;
};

const Withdraw = () => {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [fees, setFees] = useState({ percent: 0, fixed: 1.5 });
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    // Fetch platform fees
    const fetchFees = async () => {
      const { data } = await supabase
        .from("platform_fees")
        .select("withdrawal_fee_percent, withdrawal_fee_fixed")
        .limit(1)
        .single();
      if (data) setFees({ percent: data.withdrawal_fee_percent, fixed: data.withdrawal_fee_fixed });
    };
    fetchFees();
  }, [user]);

  // Fetch withdrawal history + realtime
  useEffect(() => {
    if (!user) return;
    const fetchWithdrawals = async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setWithdrawals(data || []);
      setHistoryLoading(false);
    };
    fetchWithdrawals();

    const channel = supabase
      .channel("withdrawals-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchWithdrawals()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const balance = wallet?.balance ?? 0;
  const parsedAmount = parseFloat((amount || "0").replace(",", "."));
  const feeAmount = isNaN(parsedAmount) || parsedAmount <= 0 ? 0 : Number((parsedAmount * fees.percent / 100 + fees.fixed).toFixed(2));
  const netAmount = Math.max(0, Number((parsedAmount - feeAmount).toFixed(2)));


  const handleRequestWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));

    if (!pixKey.trim()) {
      toast.error("Informe sua chave PIX");
      return;
    }
    if (!validatePixKey(pixKey)) {
      toast.error("Chave PIX inválida. Use CPF, telefone, e-mail ou chave aleatória.");
      return;
    }
    if (isNaN(value) || value < MIN_WITHDRAW) {
      toast.error(`Valor mínimo para saque: R$ ${MIN_WITHDRAW},00`);
      return;
    }
    if (value > balance) {
      toast.error("Saldo insuficiente");
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmWithdraw = async () => {
    const value = parseFloat(amount.replace(",", "."));
    setShowConfirm(false);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-withdrawal", {
        body: { amount: value, pixKey: pixKey.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuccess(true);
      toast.success("Saque processado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar saque");
    } finally {
      setLoading(false);
    }
  };

  const balanceAfter = Number((balance - parsedAmount).toFixed(2));

  if (success) {
    return (
      <AppLayout>
        <motion.div
          className="p-5 md:p-8 pt-16 md:pt-8 max-w-xl mx-auto space-y-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
            <div className="bg-primary/5 border-b border-primary/10 px-5 py-6 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 mb-3">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Saque Processado!</h2>
              <p className="text-[12px] text-muted-foreground mt-1">
                Seu saque está sendo processado automaticamente
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary font-mono-value">
                  R$ {parseFloat(amount.replace(",", ".")).toFixed(2).replace(".", ",")}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2.5 text-[12px]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Key className="h-3.5 w-3.5" />
                  <span>Chave PIX: <span className="text-foreground font-medium">{pixKey}</span></span>
                </div>
              </div>

              <Button
                onClick={() => navigate("/carteira")}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl"
              >
                Ver Carteira
              </Button>
            </div>
          </div>
        </motion.div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        className="p-5 md:p-8 pt-16 md:pt-8 max-w-xl mx-auto space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Sacar Fundos</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Receba seu saldo diretamente na sua conta via PIX
          </p>
        </div>

        {/* Balance Card */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/8 p-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[12px] text-muted-foreground font-medium">Saldo disponível</span>
          </div>
          <span className="text-lg font-bold text-foreground font-mono-value">
            R$ {balance.toFixed(2).replace(".", ",")}
          </span>
        </div>

        {/* Withdraw Form */}
        <form onSubmit={handleRequestWithdraw}>
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-primary/15 p-2">
                <ArrowUpFromLine className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-[15px] font-bold text-foreground">Novo Saque</h2>
            </div>

            {/* PIX Key */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Key className="h-3 w-3 text-primary" />
                <span className="text-[13px] text-foreground font-medium">Chave PIX</span>
              </div>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger className="h-12 bg-secondary/50 border-border rounded-xl text-[13px]">
                  <SelectValue placeholder="Tipo de chave" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="TELEFONE">Telefone</SelectItem>
                  <SelectItem value="ALEATORIA">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="text"
                placeholder={
                  pixKeyType === "CPF" ? "000.000.000-00" :
                  pixKeyType === "CNPJ" ? "00.000.000/0000-00" :
                  pixKeyType === "EMAIL" ? "email@exemplo.com" :
                  pixKeyType === "TELEFONE" ? "+5511999999999" :
                  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                }
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                required
                className="h-14 text-[14px] bg-secondary/50 border-border rounded-xl"
              />
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Banknote className="h-3 w-3 text-primary" />
                <span className="text-[13px] text-foreground font-medium">Valor do saque</span>
                <span className="text-[12px] text-muted-foreground">(mínimo R$ {MIN_WITHDRAW},00)</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-[15px] font-semibold">
                  R$
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="pl-12 h-14 text-lg bg-secondary/50 border-border font-mono-value rounded-xl"
                />
              </div>
            </div>

            {/* Fee Breakdown */}
            {parsedAmount >= MIN_WITHDRAW && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor solicitado</span>
                  <span className="font-mono-value">R$ {parsedAmount.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa fixa</span>
                  <span className="font-mono-value text-destructive">- R$ {feeAmount.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold text-foreground">
                  <span>Você recebe</span>
                  <span className="font-mono-value text-primary">R$ {netAmount.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            )}

            {/* CTA */}
            <Button
              type="submit"
              disabled={loading || !amount || !pixKey}
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2.5 text-[15px] rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="h-5 w-5" />
                  Solicitar Saque
                </>
              )}
            </Button>
          </div>
        </form>
        {/* Withdrawal History */}
        <WithdrawalHistory withdrawals={withdrawals} loading={historyLoading} />

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="max-w-sm bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Resumo do Saque</DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                Confirme os valores que serão debitados da sua conta.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground mb-1">
                <Info className="h-4 w-4 text-primary" />
                Valores a Debitar
              </div>

              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>Valor do saque:</span>
                <span className="font-mono-value text-foreground font-medium">R$ {parsedAmount.toFixed(2).replace(".", ",")}</span>
              </div>

              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>Taxa de saque:</span>
                <span className="font-mono-value">
                  <span className="text-destructive">- R$ {feeAmount.toFixed(2).replace(".", ",")}</span>
                </span>
              </div>

              <div className="border-t border-border pt-2 flex justify-between text-[13px] font-bold text-foreground">
                <span>Você recebe:</span>
                <span className="font-mono-value text-primary">R$ {netAmount.toFixed(2).replace(".", ",")}</span>
              </div>

              <div className="border-t border-border pt-2 space-y-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold text-foreground">Saldo atual:</span>
                  <span className="font-mono-value text-foreground">R$ {balance.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold text-foreground">Saldo após saque:</span>
                  <span className={`font-mono-value font-semibold ${balanceAfter < 0 ? "text-destructive" : "text-foreground"}`}>
                    R$ {balanceAfter.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-11 rounded-xl border-border"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmWithdraw}
                disabled={loading || balanceAfter < 0}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Saque"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-yellow-400" },
  processing: { label: "Processando", icon: RefreshCw, color: "text-blue-400" },
  completed: { label: "Concluído", icon: CheckCircle2, color: "text-primary" },
  approved: { label: "Aprovado", icon: CheckCircle2, color: "text-primary" },
  failed: { label: "Falhou", icon: XCircle, color: "text-destructive" },
  rejected: { label: "Rejeitado", icon: XCircle, color: "text-destructive" },
};

const WithdrawalHistory = ({ withdrawals, loading }: { withdrawals: any[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold text-foreground">Histórico de Saques</h2>
        </div>
      </div>

      {withdrawals.length === 0 ? (
        <div className="p-8 text-center">
          <ArrowUpFromLine className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">Nenhum saque realizado</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {withdrawals.map((w) => {
            const config = statusConfig[w.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const date = new Date(w.created_at);
            return (
              <div key={w.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-1.5 bg-secondary/50 ${config.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground font-mono-value">
                      R$ {Number(w.amount).toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {w.pix_key} · {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold ${config.color}`}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Withdraw;
