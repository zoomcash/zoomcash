import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useMerchant, useMerchantTransactions, useMerchantBalance, useMerchantLedger, useMerchantWebhookDeliveries } from "@/hooks/useMerchant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Navigate, Link } from "react-router-dom";
import {
  ArrowLeft, Copy, RefreshCw, Key, Globe, DollarSign,
  Activity, Shield, BookOpen, CheckCircle, XCircle, Clock,
  AlertTriangle, Eye, EyeOff
} from "lucide-react";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  refunded: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  review_required: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  sent: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  retrying: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const MerchantDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { merchant, isLoading, createMerchant, rotateApiKey, updateWebhookUrl } = useMerchant();
  const { data: transactions } = useMerchantTransactions(merchant?.id);
  const { data: balance } = useMerchantBalance(merchant?.id);
  const { data: ledger } = useMerchantLedger(merchant?.id);
  const { data: webhookDeliveries } = useMerchantWebhookDeliveries(merchant?.id);
  const { toast } = useToast();

  const [merchantName, setMerchantName] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookInput, setWebhookInput] = useState("");

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Onboarding: Create merchant
  if (!merchant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="w-full max-w-md border-border/60 bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Criar conta Merchant</CardTitle>
              <CardDescription>Configure seu gateway para começar a receber pagamentos via API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nome do seu negócio"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={!merchantName.trim() || createMerchant.isPending}
                onClick={async () => {
                  const result = await createMerchant.mutateAsync(merchantName.trim());
                  setNewApiKey(result.apiKey);
                  toast({ title: "Merchant criado com sucesso!" });
                }}
              >
                {createMerchant.isPending ? "Criando..." : "Criar Merchant"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const paidTx = transactions?.filter((t) => t.status === "paid") || [];
  const totalVolume = paidTx.reduce((acc, t) => acc + Number(t.amount), 0);
  const avgTicket = paidTx.length > 0 ? totalVolume / paidTx.length : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-sm font-bold">{merchant.name}</h1>
              <p className="text-[11px] text-muted-foreground font-mono">{merchant.api_key_prefix}••••</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/merchant/clientes">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Clientes
              </Button>
            </Link>
            <Badge variant="outline" className={`text-[11px] ${merchant.status === "active" ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}>
              {merchant.status}
            </Badge>
          </div>
        </div>
      </header>

      <div className="container py-6 space-y-6">
        {/* New API Key Banner */}
        {newApiKey && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-bold text-foreground">Sua API Key foi gerada!</p>
                    <p className="text-xs text-muted-foreground">Copie agora — ela não será exibida novamente.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background/80 border border-border rounded px-3 py-2 text-xs font-mono break-all">
                        {showApiKey ? newApiKey : "••••••••••••••••••••••••••••••••"}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowApiKey(!showApiKey)}>
                        {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(newApiKey);
                          toast({ title: "API Key copiada!" });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setNewApiKey(null)}>
                      Já copiei, pode fechar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Saldo", value: `R$ ${(balance || 0).toFixed(2)}`, icon: DollarSign, color: "text-emerald-400" },
            { label: "Transações", value: String(transactions?.length || 0), icon: Activity, color: "text-blue-400" },
            { label: "Volume", value: `R$ ${totalVolume.toFixed(2)}`, icon: BookOpen, color: "text-primary" },
            { label: "Ticket médio", value: `R$ ${avgTicket.toFixed(2)}`, icon: Activity, color: "text-purple-400" },
          ].map((s) => (
            <Card key={s.label} className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{s.label}</span>
                </div>
                <p className="text-lg font-extrabold font-mono tracking-tight">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="bg-card border border-border/40">
            <TabsTrigger value="transactions">Transações</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            <TabsTrigger value="docs">API Docs</TabsTrigger>
          </TabsList>

          {/* Transactions */}
          <TabsContent value="transactions">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-base">Transações recentes</CardTitle>
              </CardHeader>
              <CardContent>
                {!transactions?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação ainda</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-background/50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${statusColor[tx.status] || ""}`}>
                              {tx.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono truncate">{tx.id.slice(0, 8)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {tx.description || tx.payment_method} • {new Date(tx.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono">R$ {Number(tx.amount).toFixed(2)}</p>
                          {tx.risk_score > 0 && (
                            <span className={`text-[10px] ${tx.risk_score >= 70 ? "text-red-400" : tx.risk_score >= 40 ? "text-yellow-400" : "text-muted-foreground"}`}>
                              Risk: {tx.risk_score}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ledger */}
          <TabsContent value="ledger">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-base">Ledger financeiro</CardTitle>
                <CardDescription>Registro imutável de todas as movimentações</CardDescription>
              </CardHeader>
              <CardContent>
                {!ledger?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrada no ledger</p>
                ) : (
                  <div className="space-y-2">
                    {ledger.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-background/50">
                        <div>
                          <Badge variant="outline" className={`text-[10px] ${
                            entry.entry_type === "credit" ? "border-emerald-500/30 text-emerald-400" :
                            entry.entry_type === "fee" ? "border-yellow-500/30 text-yellow-400" :
                            entry.entry_type === "refund" ? "border-purple-500/30 text-purple-400" :
                            "border-red-500/30 text-red-400"
                          }`}>
                            {entry.entry_type}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground mt-1">{entry.description}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold font-mono ${entry.entry_type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                            {entry.entry_type === "credit" ? "+" : "-"}R$ {Number(entry.amount).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">Saldo: R$ {Number(entry.balance_after).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-base">Entregas de Webhook</CardTitle>
                <CardDescription>Histórico de notificações enviadas ao seu endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                {!webhookDeliveries?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrega ainda</p>
                ) : (
                  <div className="space-y-2">
                    {webhookDeliveries.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-background/50">
                        <div>
                          <div className="flex items-center gap-2">
                            {d.status === "sent" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> :
                             d.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-400" /> :
                             <Clock className="h-3.5 w-3.5 text-yellow-400" />}
                            <span className="text-xs font-bold">{d.event_type}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Tentativas: {d.attempts}/{d.max_attempts} • {new Date(d.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${statusColor[d.status] || ""}`}>
                          {d.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <div className="space-y-4">
              {/* API Key Management */}
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> API Key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background/80 border border-border rounded px-3 py-2 text-xs font-mono">
                      {merchant.api_key_prefix}••••••••••••••••
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={rotateApiKey.isPending}
                      onClick={async () => {
                        if (confirm("Tem certeza? A chave atual será invalidada permanentemente.")) {
                          const key = await rotateApiKey.mutateAsync();
                          setNewApiKey(key);
                        }
                      }}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${rotateApiKey.isPending ? "animate-spin" : ""}`} />
                      Rotacionar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Webhook URL */}
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Webhook URL</CardTitle>
                  <CardDescription>Endpoint para receber notificações de pagamento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="https://seu-site.com/webhook"
                    value={webhookInput || merchant.webhook_url || ""}
                    onChange={(e) => setWebhookInput(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={updateWebhookUrl.isPending || !webhookInput.trim()}
                      onClick={() => updateWebhookUrl.mutate(webhookInput.trim())}
                    >
                      Salvar
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        Webhook secret protegido no backend
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* API Docs */}
          <TabsContent value="docs">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Documentação da API</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold mb-2">Autenticação</h3>
                  <p className="text-xs text-muted-foreground mb-2">Inclua sua API Key em todas as requisições:</p>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`Headers:
  x-api-key: gw_live_xxxxxxxxxxxxxxxx`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2">POST /payments</h3>
                  <p className="text-xs text-muted-foreground mb-2">Criar nova cobrança</p>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`curl -X POST \\
  https://<project>.supabase.co/functions/v1/gateway-api/payments \\
  -H "x-api-key: gw_live_xxx" \\
  -H "x-idempotency-key: unique-key-123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 100.00,
    "description": "Pedido #1234",
    "customer_email": "cliente@email.com",
    "customer_document": "12345678900"
  }'`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2">GET /payments/:id</h3>
                  <p className="text-xs text-muted-foreground mb-2">Consultar status</p>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`curl https://<project>.supabase.co/functions/v1/gateway-api/payments/<uuid> \\
  -H "x-api-key: gw_live_xxx"`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2">GET /transactions</h3>
                  <p className="text-xs text-muted-foreground mb-2">Listar transações (com paginação)</p>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`curl "https://<project>.supabase.co/functions/v1/gateway-api/transactions?page=1&limit=20&status=paid" \\
  -H "x-api-key: gw_live_xxx"`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2">POST /refunds</h3>
                  <p className="text-xs text-muted-foreground mb-2">Reembolsar transação paga</p>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`curl -X POST \\
  https://<project>.supabase.co/functions/v1/gateway-api/refunds \\
  -H "x-api-key: gw_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"transaction_id": "<uuid>", "reason": "Cliente solicitou"}'`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2">GET /balance</h3>
                  <p className="text-xs text-muted-foreground mb-2">Consultar saldo do merchant (derivado do ledger)</p>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`curl https://<project>.supabase.co/functions/v1/gateway-api/balance \\
  -H "x-api-key: gw_live_xxx"`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2">Webhooks</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Configure sua URL de webhook nas configurações. Cada notificação inclui um header
                    <code className="bg-background border border-border rounded px-1 mx-1">X-Gateway-Signature</code>
                    com HMAC-SHA256 do payload usando seu webhook secret.
                  </p>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`// Eventos:
// payment.paid
// payment.failed
// payment.refunded

// Payload:
{
  "transaction_id": "uuid",
  "status": "paid",
  "amount": 100.00,
  "currency": "BRL"
}`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-2">GET /health</h3>
                  <pre className="bg-background/80 border border-border rounded p-3 text-xs font-mono overflow-x-auto">
{`curl https://<project>.supabase.co/functions/v1/gateway-api/health`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MerchantDashboard;
