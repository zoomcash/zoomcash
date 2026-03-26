import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeftRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const InternalTransfer = () => {
  const { user, loading } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const handleTransfer = () => {
    if (!email.trim() || !amount.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    toast.info("Funcionalidade em desenvolvimento");
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 pt-16 md:pt-8 max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Transferência Interna</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Envie saldo para outro usuário da plataforma
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-primary/5 p-3">
          <AlertTriangle className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[12px] text-foreground">
            Transferências internas <strong>não possuem taxas</strong>.
          </p>
        </div>

        {/* Transfer Form */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-primary/8 p-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-[14px] font-semibold text-foreground">Nova Transferência</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium mb-1 block uppercase tracking-wider">
                E-mail do destinatário
              </label>
              <Input
                type="email"
                placeholder="usuario@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/50 border-border h-10 text-[13px]"
              />
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground font-medium mb-1 block uppercase tracking-wider">
                Valor <span className="normal-case">(Disponível: R$ {(wallet?.balance ?? 0).toFixed(2).replace(".", ",")})</span>
              </label>
              <Input
                type="number"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-secondary/50 border-border h-10 text-[13px]"
              />
            </div>

            <Button
              onClick={handleTransfer}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[13px]"
            >
              Transferir
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default InternalTransfer;
