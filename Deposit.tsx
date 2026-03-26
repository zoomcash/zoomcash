import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const QUICK_AMOUNTS = [10, 25, 50, 100, 200, 500];

const Deposit = () => {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{
    qrcodeUrl?: string;
    qrCodeBase64?: string;
    copyPaste?: string;
    amount: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [fees, setFees] = useState({ percent: 0, fixed: 1.0 });

  // Fetch deposit fees
  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
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

  if (!user) return null;

  const parsedAmount = parseFloat((amount || "0").replace(",", "."));
  const feeAmount = isNaN(parsedAmount) || parsedAmount <= 0 ? 0 : Number((parsedAmount * fees.percent / 100 + fees.fixed).toFixed(2));
  const netCredit = Math.max(0, Number((parsedAmount - feeAmount).toFixed(2)));

  const handleDeposit = async () => {
    const value = parseFloat(amount);
    if (!value || value < 2) {
      toast.error("Valor mínimo: R$ 2,00");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-deposit", {
        body: { amount: value },
      });

      // Edge function errors: extract message from response body
      if (error) {
        const errBody = typeof error === 'object' && 'context' in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        throw new Error(errBody?.error || error.message || "Erro ao gerar PIX");
      }
      if (data?.error) throw new Error(data.error);

      setPixData(data);
      toast.success("PIX gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!pixData?.copyPaste) return;
    await navigator.clipboard.writeText(pixData.copyPaste);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />

      <div className="container max-w-lg py-4">
        <Link
          to="/wallet"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {/* Balance */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-card border border-border p-3">
          <span className="text-sm text-muted-foreground">Seu saldo:</span>
          <span className="font-display text-lg text-primary">
            R$ {wallet?.balance?.toFixed(2) ?? "0.00"}
          </span>
        </div>

        {!pixData ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h1 className="font-display text-xl text-foreground mb-1">Depositar via PIX</h1>
              <p className="text-sm text-muted-foreground mb-2">
                Escolha o valor e pague via PIX para adicionar saldo instantaneamente.
              </p>
              <p className="text-xs text-amber-500 mb-4">
                Depósito mínimo: R$ 2,00 · Taxa fixa de R$ 1,00 por transação
              </p>

              {/* Quick amounts */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {QUICK_AMOUNTS.map((qa) => (
                  <button
                    key={qa}
                    onClick={() => setAmount(String(qa))}
                    className={`rounded-lg border-2 py-3 text-center transition-all ${
                      amount === String(qa)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span className="font-display text-lg">R$ {qa}</span>
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">
                  Ou digite o valor
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    R$
                  </span>
                  <Input
                    type="number"
                    min="2"
                    step="0.01"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10 font-display text-lg"
                  />
                </div>
              </div>

              {/* Fee Breakdown */}
              {parsedAmount >= 2 && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-[12px]">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Valor do PIX</span>
                    <span className="font-mono">R$ {parsedAmount.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa fixa</span>
                    <span className="font-mono text-destructive">- R$ {feeAmount.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between font-semibold text-foreground">
                    <span>Creditado na carteira</span>
                    <span className="font-mono text-primary">R$ {netCredit.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleDeposit}
                disabled={loading || !amount || parseFloat(amount) < 2}
                className="w-full rounded-full bg-primary text-primary-foreground font-display text-lg tracking-wide hover:bg-primary/90 box-glow py-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Gerando PIX...
                  </>
                ) : (
                  <>
                    <QrCode className="h-5 w-5" />
                    Gerar PIX
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full rounded-xl border border-border bg-card p-6 text-center">
              <h2 className="font-display text-xl text-foreground mb-1">Pague via PIX</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Escaneie o QR Code ou copie o código abaixo
              </p>

              <div className="mb-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 inline-block">
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="font-display text-3xl text-primary text-glow">
                  R$ {pixData.amount.toFixed(2).replace(".", ",")}
                </p>
              </div>

              {/* QR Code */}
              {(pixData.qrCodeBase64 || pixData.qrcodeUrl) && (
                <div className="mx-auto mb-4 flex justify-center">
                  <img
                    src={pixData.qrCodeBase64 || pixData.qrcodeUrl}
                    alt="QR Code PIX"
                    className="h-56 w-56 rounded-lg bg-white p-2"
                  />
                </div>
              )}

              {/* Copy paste */}
              {pixData.copyPaste && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    PIX Copia e Cola
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={pixData.copyPaste}
                      className="text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Após o pagamento, seu saldo será atualizado automaticamente.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setPixData(null);
                setAmount("");
              }}
              className="rounded-full"
            >
              Novo Depósito
            </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Deposit;
