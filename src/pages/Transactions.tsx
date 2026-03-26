import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowUpRight, ArrowDownLeft, Filter } from "lucide-react";

const Transactions = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: transactions } = useQuery({
    queryKey: ["all-transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered =
    filter === "all"
      ? transactions
      : transactions?.filter((t) => t.type === filter);

  const typeLabels: Record<string, string> = {
    deposit: "Depósito",
    withdrawal: "Saque",
    bet: "Aposta",
    win: "Ganho",
    bonus: "Bônus",
  };

  return (
    <AppLayout>
      <div className="p-5 md:p-8 pt-16 md:pt-8 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Transações</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Histórico completo de movimentações
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-foreground"
            >
              <option value="all">Todos</option>
              <option value="deposit">Depósitos</option>
              <option value="withdrawal">Saques</option>
              <option value="bonus">Bônus</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-5 gap-4 px-5 py-2.5 border-b border-border text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            <span>Tipo</span>
            <span>Descrição</span>
            <span>Data</span>
            <span>Status</span>
            <span className="text-right">Valor</span>
          </div>

          <div className="divide-y divide-border/50">
            {filtered?.map((tx) => {
              const isPositive = tx.type === "deposit" || tx.type === "win" || tx.type === "bonus";
              return (
                <div
                  key={tx.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 px-5 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`rounded-md p-1 ${isPositive ? "bg-emerald-500/8" : "bg-red-500/8"}`}>
                      {isPositive ? (
                        <ArrowDownLeft className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-red-400" />
                      )}
                    </div>
                    <span className="text-[13px] font-medium text-foreground">
                      {typeLabels[tx.type] || tx.type}
                    </span>
                  </div>
                  <span className="text-[13px] text-muted-foreground truncate">
                    {tx.description || "—"}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString("pt-BR")}
                  </span>
                  <span>
                    <span className="inline-flex text-[10px] rounded-full bg-primary/8 text-primary px-2 py-0.5 font-medium">
                      Concluído
                    </span>
                  </span>
                  <span
                    className={`text-[13px] font-bold text-right font-mono-value ${
                      isPositive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isPositive ? "+" : "-"}R$ {Math.abs(tx.amount).toFixed(2).replace(".", ",")}
                  </span>
                </div>
              );
            })}

            {(!filtered || filtered.length === 0) && (
              <p className="py-12 text-center text-[13px] text-muted-foreground">
                Nenhuma transação encontrada
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Transactions;
