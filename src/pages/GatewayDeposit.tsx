import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Wallet, Download, QrCode, Copy, Check, Loader2, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const GatewayDeposit = () => {
  const { user, loading: authLoading } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("2,00");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixData, setPixData] = useState<{
    qrcodeUrl?: string;
    qrCodeBase64?: string;
    copyPaste?: string;
    amount: number;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const handleDeposit = async () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value < 2) {
      toast.error("Valor mínimo: R$ 2,00");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-deposit", {
        body: { amount: value },
      });
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
    <AppLayout>
      <motion.div
        className="p-5 md:p-8 pt-16 md:pt-8 max-w-xl mx-auto space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Depositar Fundos</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Adicione saldo à sua carteira de forma rápida e segura
          </p>
        </div>

        {!pixData ? (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            {/* Card header */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-primary/15 p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-[15px] font-bold text-foreground">Novo Depósito</h2>
            </div>

            {/* Amount label */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Download className="h-3 w-3 text-primary" />
                <span className="text-[13px] text-foreground font-medium">Valor do depósito</span>
                <span className="text-[12px] text-muted-foreground">(mínimo R$ 2,00)</span>
              </div>

              {/* Amount input */}
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
                  className="pl-12 h-14 text-lg bg-secondary/50 border-border font-mono-value focus:border-primary/50 focus:ring-primary/20 rounded-xl"
                />
              </div>
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleDeposit}
              disabled={loading || !amount}
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2.5 text-[15px] rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Gerando PIX...
                </>
              ) : (
                <>
                  <QrCode className="h-5 w-5" />
                  Gerar QR Code PIX
                </>
              )}
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
              {/* Success header */}
              <div className="bg-primary/5 border-b border-primary/10 px-5 py-4 text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary mb-2">
                  <Check className="h-3 w-3" />
                  PIX Gerado
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Escaneie o QR Code ou copie o código abaixo
                </p>
              </div>

              <div className="p-5 space-y-5">
                {/* Amount */}
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Valor a pagar</p>
                  <p className="text-3xl font-bold text-primary font-mono-value">
                    R$ {pixData.amount.toFixed(2).replace(".", ",")}
                  </p>
                </div>

                {/* QR Code */}
                {(pixData.qrCodeBase64 || pixData.qrcodeUrl) && (
                  <div className="flex justify-center">
                    <div className="rounded-2xl border border-border bg-white p-3">
                      <img
                        src={pixData.qrCodeBase64 || pixData.qrcodeUrl}
                        alt="QR Code PIX"
                        className="h-52 w-52 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {/* Copy paste */}
                {pixData.copyPaste && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider text-center">
                      PIX Copia e Cola
                    </p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={pixData.copyPaste}
                        className="text-[11px] font-mono-value h-10 bg-secondary/40 border-border"
                      />
                      <Button
                        variant="outline"
                        onClick={handleCopy}
                        className={`shrink-0 h-10 gap-1.5 text-[12px] px-4 transition-all ${
                          copied ? "border-primary/30 bg-primary/10 text-primary" : "hover:border-primary/30"
                        }`}
                      >
                        {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground text-center">
                  Após o pagamento, seu saldo será creditado <span className="text-primary font-medium">automaticamente</span>.
                </p>

                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setPixData(null); setAmount("2,00"); }}
                    className="text-[12px] text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Fazer outro depósito
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default GatewayDeposit;
