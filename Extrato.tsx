import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Calendar,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, startOfWeek, startOfMonth } from "date-fns";

type PeriodFilter = "today" | "yesterday" | "week" | "month" | "all" | "custom";

const Extrato = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: transactions } = useQuery({
    queryKey: ["extrato", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const typeLabels: Record<string, string> = {
    deposit: "Depósito",
    withdrawal: "Retirada",
    bet: "Aposta",
    win: "Ganho",
    bonus: "Bônus",
  };

  const periodLabels: Record<PeriodFilter, string> = {
    today: "Hoje",
    yesterday: "Ontem",
    week: "Semana",
    month: "Mês",
    all: "Todo período",
    custom: "Personalizado",
  };

  const getDateRange = (period: PeriodFilter): { from: Date | null; to: Date | null } => {
    const now = new Date();
    switch (period) {
      case "today":
        return { from: startOfDay(now), to: now };
      case "yesterday":
        return { from: startOfDay(subDays(now, 1)), to: startOfDay(now) };
      case "week":
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
      case "month":
        return { from: startOfMonth(now), to: now };
      case "custom":
        return { from: customDateFrom || null, to: customDateTo || null };
      default:
        return { from: null, to: null };
    }
  };

  const filtered = useMemo(() => {
    let arr = transactions || [];

    // Type filter
    if (typeFilter !== "all") {
      const isEntrada = typeFilter === "entrada";
      arr = arr.filter((t) => {
        const positive = t.type === "deposit" || t.type === "win" || t.type === "bonus";
        return isEntrada ? positive : !positive;
      });
    }

    // Period filter
    const { from, to } = getDateRange(periodFilter);
    if (from) {
      arr = arr.filter((t) => new Date(t.created_at) >= from);
    }
    if (to && periodFilter !== "all") {
      arr = arr.filter((t) => new Date(t.created_at) <= to);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          (t.description || "").toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          (typeLabels[t.type] || t.type).toLowerCase().includes(q)
      );
    }
    return arr;
  }, [transactions, search, typeFilter, periodFilter, customDateFrom, customDateTo]);

  const isPositive = (type: string) =>
    type === "deposit" || type === "win" || type === "bonus";

  const exportCSV = () => {
    if (!filtered?.length) return;
    const header = "Tipo,Tipo Transação,Descrição,Data,Status,Valor\n";
    const rows = filtered
      .map((t) => {
        const tipo = isPositive(t.type) ? "Entrada" : "Saída";
        const tipoTx = typeLabels[t.type] || t.type;
        const desc = (t.description || "").replace(/,/g, ";");
        const data = new Date(t.created_at).toLocaleString("pt-BR");
        const valor = `R$ ${Math.abs(t.amount).toFixed(2)}`;
        return `${tipo},${tipoTx},${desc},${data},Concluído,${valor}`;
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Extrato</h1>
          <p className="text-sm text-muted-foreground">
            Veja suas movimentações recentes de forma simples e organizada.
          </p>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5" />
                Baixar Extrato
              </Button>
            </div>
          </div>

          {/* Inline Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Tipo de transação
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Período
              </label>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodFilter === "custom" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">De</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal", !customDateFrom && "text-muted-foreground")}>
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {customDateFrom ? format(customDateFrom, "dd/MM/yyyy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Até</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal", !customDateTo && "text-muted-foreground")}>
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {customDateTo ? format(customDateTo, "dd/MM/yyyy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead className="text-[11px] uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Tipo Transação</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Descrição</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">ID Referência</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Data de Criação</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!filtered || filtered.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      Nenhuma movimentação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tx) => {
                    const positive = isPositive(tx.type);
                    return (
                      <TableRow key={tx.id} className="border-border/20 hover:bg-secondary/20">
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {positive ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-orange-400" />
                            )}
                            <span className={`text-sm font-medium ${positive ? "text-emerald-400" : "text-orange-400"}`}>
                              {positive ? "Entrada" : "Saída"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px] font-medium">
                            {typeLabels[tx.type] || tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {tx.description || "—"}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {tx.id.slice(0, 6)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString("pt-BR")} - {new Date(tx.created_at).toLocaleTimeString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-500/30 text-emerald-400"
                          >
                            Concluído
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Extrato;
