import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Percent, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const GatewaySettings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data: fees } = useQuery({
    queryKey: ["platform-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_fees")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 pt-16 md:pt-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Configurações</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Gerencie suas preferências e segurança
          </p>
        </div>

        {/* Transaction Fees */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-3">
            Taxas de Transação
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="rounded-md bg-primary/8 p-1.5">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[12px] font-semibold text-foreground">Taxa PIX</span>
              </div>
              <p className="text-lg font-bold text-foreground font-mono-value">
                {fees?.pix_fee_percent ?? 0}% + R$ {(fees?.pix_fee_fixed ?? 1).toFixed(2).replace(".", ",")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                por transação
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="rounded-md bg-orange-400/8 p-1.5">
                  <Percent className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <span className="text-[12px] font-semibold text-foreground">Taxa de Saque</span>
              </div>
              <p className="text-lg font-bold text-foreground font-mono-value">
                {fees?.withdrawal_fee_percent ?? 0}% + R$ {(fees?.withdrawal_fee_fixed ?? 1).toFixed(2).replace(".", ",")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                por transação
              </p>
            </div>
          </div>
        </div>

        {/* Security */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-3">
            Segurança
          </p>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-primary/8 p-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">Alterar Senha</h3>
                <p className="text-[11px] text-muted-foreground">
                  Mantenha sua conta segura
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "Senha Atual", value: currentPassword, setter: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(!showCurrent), placeholder: "Senha atual" },
                { label: "Nova Senha", value: newPassword, setter: setNewPassword, show: showNew, toggle: () => setShowNew(!showNew), placeholder: "Nova senha" },
                { label: "Confirmar", value: confirmPassword, setter: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(!showConfirm), placeholder: "Confirme a nova senha" },
              ].map((field) => (
                <div key={field.label}>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                    {field.label}
                  </label>
                  <div className="relative">
                    <Input
                      type={field.show ? "text" : "password"}
                      placeholder={field.placeholder}
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      className="bg-secondary/50 border-border h-10 pr-9 text-[13px] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={field.toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                    >
                      {field.show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}

              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-[13px] rounded-lg"
              >
                {changingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Alterar Senha"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default GatewaySettings;
