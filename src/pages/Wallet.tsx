import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Gift, Zap, Trophy } from "lucide-react";

const Wallet = () => {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  const { data: transactions } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
    deposit: { icon: ArrowDownRight, label: "Depósito", color: "text-casino-green" },
    withdrawal: { icon: ArrowUpRight, label: "Saque", color: "text-casino-red" },
    bet: { icon: Zap, label: "Aposta", color: "text-casino-red" },
    win: { icon: Trophy, label: "Ganho", color: "text-casino-green" },
    bonus: { icon: Gift, label: "Bônus", color: "text-primary" },
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 rounded-xl border border-primary/30 bg-card p-8 text-center box-glow">
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="font-display text-5xl text-primary text-glow">
              R$ {wallet?.balance?.toFixed(2) ?? "0.00"}
            </p>
          </div>

          <h3 className="mb-4 font-display text-xl text-foreground">Histórico</h3>
          <div className="space-y-2">
            {transactions?.map((tx) => {
              const config = typeConfig[tx.type] || typeConfig.deposit;
              const Icon = config.icon;
              const isPositive = tx.type === "deposit" || tx.type === "win" || tx.type === "bonus";

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full bg-secondary p-2 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{config.label}</p>
                      <p className="text-xs text-muted-foreground">{tx.description}</p>
                    </div>
                  </div>
                  <p className={`font-display text-lg ${isPositive ? "text-casino-green" : "text-casino-red"}`}>
                    {isPositive ? "+" : "-"}R${Math.abs(tx.amount).toFixed(2)}
                  </p>
                </div>
              );
            })}

            {(!transactions || transactions.length === 0) && (
              <p className="py-8 text-center text-muted-foreground">Nenhuma transação ainda</p>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Wallet;
