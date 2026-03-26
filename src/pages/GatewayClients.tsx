import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMerchant, useMerchantTransactions } from "@/hooks/useMerchant";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Eye,
  EyeOff,
  Users,
  DollarSign,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface ClientRow {
  key: string;
  name: string;
  email: string;
  document: string;
  totalSpent: number;
  purchases: number;
  lastPurchase: string | null;
  transactions: any[];
}

const GatewayClients = () => {
  const { user, loading: authLoading } = useAuth();
  const { merchant, isLoading } = useMerchant();
  const { data: transactions } = useMerchantTransactions(merchant?.id);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [visibleDocs, setVisibleDocs] = useState<Set<string>>(new Set());
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  const clients = useMemo(() => {
    if (!transactions) return [];

    const map = new Map<string, ClientRow>();

    for (const tx of transactions) {
      const key = tx.customer_document || tx.customer_email || tx.id;
      const existing = map.get(key);

      if (existing) {
        if (tx.status === "paid") {
          existing.totalSpent += Number(tx.amount);
          existing.purchases += 1;
        }
        if (!existing.lastPurchase || tx.created_at > existing.lastPurchase) {
          existing.lastPurchase = tx.created_at;
        }
        if (!existing.email && tx.customer_email) existing.email = tx.customer_email;
        if (!existing.document && tx.customer_document) existing.document = tx.customer_document;
        existing.transactions.push(tx);
      } else {
        const isPaid = tx.status === "paid";
        map.set(key, {
          key,
          name: tx.customer_email?.split("@")[0] || tx.customer_document || "Anônimo",
          email: tx.customer_email || "-",
          document: tx.customer_document || "-",
          totalSpent: isPaid ? Number(tx.amount) : 0,
          purchases: isPaid ? 1 : 0,
          lastPurchase: tx.created_at,
          transactions: [tx],
        });
      }
    }

    let arr = Array.from(map.values());

    // Filter
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.document.includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case "recent":
        arr.sort((a, b) => (b.lastPurchase || "").localeCompare(a.lastPurchase || ""));
        break;
      case "spent":
        arr.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case "purchases":
        arr.sort((a, b) => b.purchases - a.purchases);
        break;
      case "name":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return arr;
  }, [transactions, search, sortBy]);

  const toggleDocVisibility = (key: string) => {
    setVisibleDocs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const maskDocument = (doc: string) => {
    if (doc === "-" || doc.length < 6) return doc;
    return doc.slice(0, 3) + "•••" + doc.slice(-3);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const totalClients = clients.length;
  const totalRevenue = clients.reduce((s, c) => s + c.totalSpent, 0);
  const totalPurchases = clients.reduce((s, c) => s + c.purchases, 0);
  const avgTicket = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus clientes e visualize estatísticas de compras
          </p>
        </div>

      <div className="container py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Clientes", value: String(totalClients), icon: Users, color: "text-blue-400" },
            { label: "Receita Total", value: `R$ ${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
            { label: "Compras", value: String(totalPurchases), icon: ShoppingCart, color: "text-purple-400" },
            { label: "Ticket Médio", value: `R$ ${avgTicket.toFixed(2)}`, icon: TrendingUp, color: "text-primary" },
          ].map((s) => (
            <Card key={s.label} className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {s.label}
                  </span>
                </div>
                <p className="text-lg font-extrabold font-mono tracking-tight">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="spent">Maior gasto</SelectItem>
              <SelectItem value="purchases">Mais compras</SelectItem>
              <SelectItem value="name">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-border/40">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                  <TableHead className="text-center">Compras</TableHead>
                  <TableHead>Última Compra</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {search ? "Nenhum cliente encontrado" : "Nenhuma transação registrada ainda"}
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow key={client.key} className="border-border/20 hover:bg-secondary/20">
                      <TableCell className="font-medium text-sm">{client.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{client.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-mono">
                            {client.document === "-"
                              ? "-"
                              : visibleDocs.has(client.key)
                              ? client.document
                              : maskDocument(client.document)}
                          </span>
                          {client.document !== "-" && (
                            <button
                              onClick={() => toggleDocVisibility(client.key)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {visibleDocs.has(client.key) ? (
                                <Eye className="h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm">
                        R$ {client.totalSpent.toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell className="text-center text-sm">{client.purchases}</TableCell>
                      <TableCell className="text-sm">{formatDate(client.lastPurchase)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSelectedClient(client)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Nome</span>
                  <p className="font-medium">{selectedClient.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">E-mail</span>
                  <p className="font-medium">{selectedClient.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Documento</span>
                  <p className="font-mono">{selectedClient.document}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Total Gasto</span>
                  <p className="font-mono font-bold text-emerald-400">
                    R$ {selectedClient.totalSpent.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Transações ({selectedClient.transactions.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedClient.transactions.map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-background/50"
                    >
                      <div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            tx.status === "paid"
                              ? "border-emerald-500/30 text-emerald-400"
                              : tx.status === "failed"
                              ? "border-red-500/30 text-red-400"
                              : "border-yellow-500/30 text-yellow-400"
                          }`}
                        >
                          {tx.status}
                        </Badge>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(tx.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <p className="text-sm font-bold font-mono">
                        R$ {Number(tx.amount).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </AppLayout>
  );
};

export default GatewayClients;
