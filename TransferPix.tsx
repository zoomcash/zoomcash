import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Send, QrCode, Clock, Users, Wallet, Banknote, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const MIN_TRANSFER = 2;

const TransferPix = () => {
  const { user, loading } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [pixKey, setPixKey] = useState("");
  const [amount, setAmount] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fees, setFees] = useState({ percent: 0, fixed: 0.50 });

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchFees = async () => {
      const { data } = await supabase
        .from("platform_fees")
        .select("pix_fee_percent, pix_fee_fixed")
        .limit(1)
        .single();
      if (data) setFees({ percent: data.pix_fee_percent, fixed: data.pix_fee_fixed });
    };
    fetchFees();
  }, [user]);

  const balance = wallet?.balance ?? 0;
  const parsedAmount = parseFloat((amount || "0").replace(",", "."));
  const feeAmount = isNaN(parsedAmount) || parsedAmount <= 0 ? 0 : Number((parsedAmount * fees.percent / 100 + fees.fixed).toFixed(2));
  const totalDebit = Number((parsedAmount + feeAmount).toFixed(2));
  const balanceAfter = Number((balance - totalDebit).toFixed(2));

  const handleSend = () => {
    if (!pixKey.trim()) {
      toast.error("Insira uma chave PIX válida");
      return;
    }
    const value = parseFloat(amount.replace(",", "."));
    if (isNaN(value) || value < MIN_TRANSFER) {
      toast.error(`Valor mínimo: R$ ${MIN_TRANSFER},00`);
      return;
    }
    if (totalDebit > balance) {
      toast.error("Saldo insuficiente");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmTransfer = async () => {
    setShowConfirm(false);
    setProcessing(true);
    try {
      // TODO: integrate with actual transfer endpoint
      toast.info("Funcionalidade em desenvolvimento");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 pt-16 md:pt-8 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Transferir via PIX</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Envie dinheiro de forma rápida e segura
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

        {/* New Transfer */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-primary/8 p-2">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-foreground">Nova Transferência</h2>
              <p className="text-[12px] text-muted-foreground">
                CPF, e-mail, telefone, chave aleatória ou <span className="text-primary">PIX Copia e Cola</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Cole a chave PIX ou código copia e cola"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="bg-secondary/50 border-border h-12 text-[13px] pr-9 rounded-xl"
              />
              <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Banknote className="h-3 w-3 text-primary" />
                <span className="text-[13px] text-foreground font-medium">Valor</span>
                <span className="text-[12px] text-muted-foreground">(mínimo R$ {MIN_TRANSFER},00)</span>
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
                  className="pl-12 h-14 text-lg bg-secondary/50 border-border font-mono-value rounded-xl"
                />
              </div>
            </div>

            {/* Inline fee preview */}
            {parsedAmount >= MIN_TRANSFER && (
              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor a transferir</span>
                  <span className="font-mono-value">R$ {parsedAmount.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa de transferência</span>
                  <span className="font-mono-value text-destructive">- R$ {feeAmount.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold text-foreground">
                  <span>Total a debitar</span>
                  <span className="font-mono-value text-primary">R$ {totalDebit.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleSend}
              disabled={processing || !pixKey.trim() || !amount}
              className="w-full h-14 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[15px] rounded-xl"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Transferir
                </>
              )}
            </Button>
          </div>

          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-2">
              <Users className="h-3.5 w-3.5" />
              <span className="font-medium">Contatos Recentes</span>
            </div>
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <Users className="h-5 w-5 mb-1.5 opacity-30" />
              <p className="text-[12px]">Nenhum contato recente</p>
            </div>
          </div>
        </div>

        {/* Transfer History */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold text-foreground">Histórico</h2>
          </div>
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>Página 1 de 0</span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled className="h-7 text-[11px]">‹ Anterior</Button>
              <Button variant="outline" size="sm" disabled className="h-7 text-[11px]">Próxima ›</Button>
            </div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="max-w-sm bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Resumo da Transferência</DialogTitle>
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
                <span>Valor a transferir:</span>
                <span className="font-mono-value text-foreground font-medium">R$ {parsedAmount.toFixed(2).replace(".", ",")}</span>
              </div>

              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>Taxa de transferência:</span>
                <span className="font-mono-value">
                  <span className="text-destructive">- R$ {feeAmount.toFixed(2).replace(".", ",")}</span>
                  {" "}
                  <span className="text-muted-foreground/60">R$ {feeAmount.toFixed(2).replace(".", ",")}</span>
                </span>
              </div>

              <div className="border-t border-border pt-2 flex justify-between text-[13px] font-bold text-foreground">
                <span>Valor total a debitar:</span>
                <span className="font-mono-value text-primary">R$ {totalDebit.toFixed(2).replace(".", ",")}</span>
              </div>

              <div className="border-t border-border pt-2 space-y-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold text-foreground">Saldo atual:</span>
                  <span className="font-mono-value text-foreground">R$ {balance.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold text-foreground">Saldo após transferência:</span>
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
                onClick={handleConfirmTransfer}
                disabled={processing || balanceAfter < 0}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Transferência"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default TransferPix;
