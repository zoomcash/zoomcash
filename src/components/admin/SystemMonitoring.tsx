import { useEffect, useState, useCallback } from "react";
import { useAdminApi } from "@/hooks/useAdminApi";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, Shield, Zap, CheckCircle2, XCircle,
  RefreshCw, Clock, Ban, Heart, Wifi, Server,
} from "lucide-react";
import { toast } from "sonner";

interface MonitoringData {
  timestamp: string;
  system_health: "healthy" | "degraded" | "critical";
  database: { status: string };
  providers: { misticpay: { configured: boolean } };
  counters: {
    pending_transactions: number;
    stale_pending: number;
    failed_transactions_24h: number;
    paid_transactions_24h: number;
    failed_webhook_deliveries: number;
    high_risk_alerts_24h: number;
    security_events_1h: number;
    unresolved_reconciliation: number;
  };
  active_alerts: any[];
  recent_rate_limits: any[];
  metrics_summary: Record<string, number>;
}

const severityColor = (s: string) => {
  switch (s) {
    case "critical": return "bg-destructive/20 text-destructive";
    case "high": return "bg-orange-500/20 text-orange-400";
    case "warning": return "bg-yellow-500/20 text-yellow-400";
    default: return "bg-muted text-muted-foreground";
  }
};

const healthColor = (h: string) => {
  switch (h) {
    case "healthy": return "text-primary";
    case "degraded": return "text-yellow-400";
    case "critical": return "text-destructive";
    default: return "text-muted-foreground";
  }
};

export const SystemMonitoring = () => {
  const { call, loading } = useAdminApi();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await call("system-monitoring");
      setData(result);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [call]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const resolveAlert = async (alertId: string) => {
    setResolving(alertId);
    try {
      await call(`system-alerts/${alertId}/resolve`, "POST");
      toast.success("Alerta resolvido");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResolving(null);
    }
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><RefreshCw className="animate-spin mr-2 h-5 w-5" /> Carregando monitoramento...</div>;
  }

  if (!data) return null;

  const c = data.counters;

  return (
    <div className="space-y-6">
      {/* System Health Banner */}
      <div className={`rounded-xl border p-6 ${data.system_health === "healthy" ? "border-primary/30 bg-primary/5" : data.system_health === "degraded" ? "border-yellow-500/30 bg-yellow-500/5" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className={`h-8 w-8 ${healthColor(data.system_health)}`} />
            <div>
              <h2 className={`text-2xl font-bold uppercase ${healthColor(data.system_health)}`}>{data.system_health}</h2>
              <p className="text-sm text-muted-foreground">Última verificação: {new Date(data.timestamp).toLocaleString("pt-BR")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard icon={Server} label="Banco de Dados" value={data.database.status} color="text-primary" />
        <StatusCard icon={Wifi} label="MisticPay" value={data.providers.misticpay.configured ? "Configurado" : "Não configurado"} color={data.providers.misticpay.configured ? "text-primary" : "text-destructive"} />
        <StatusCard icon={Activity} label="Pagos (24h)" value={String(c.paid_transactions_24h)} color="text-primary" />
        <StatusCard icon={XCircle} label="Falhos (24h)" value={String(c.failed_transactions_24h)} color={c.failed_transactions_24h > 0 ? "text-destructive" : "text-muted-foreground"} />
      </div>

      {/* Counters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CounterCard icon={Clock} label="TX Pendentes" value={c.pending_transactions} alert={c.pending_transactions > 10} />
        <CounterCard icon={Ban} label="TX Travadas (>30min)" value={c.stale_pending} alert={c.stale_pending > 0} />
        <CounterCard icon={AlertTriangle} label="Webhooks Falhando" value={c.failed_webhook_deliveries} alert={c.failed_webhook_deliveries > 0} />
        <CounterCard icon={Shield} label="Alto Risco (24h)" value={c.high_risk_alerts_24h} alert={c.high_risk_alerts_24h > 0} />
        <CounterCard icon={Zap} label="Eventos Seg. (1h)" value={c.security_events_1h} alert={c.security_events_1h > 5} />
        <CounterCard icon={RefreshCw} label="Reconciliação Pendente" value={c.unresolved_reconciliation} alert={c.unresolved_reconciliation > 0} />
      </div>

      {/* Metrics Summary */}
      {Object.keys(data.metrics_summary).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Activity className="h-4 w-4" /> Métricas (24h)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.metrics_summary).map(([name, count]) => (
              <div key={name} className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{name.replace(/_/g, " ")}</p>
                <p className="text-lg font-bold text-foreground">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Alerts */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Alertas Ativos ({data.active_alerts.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Tipo</th><th className="p-3">Severidade</th><th className="p-3">Mensagem</th><th className="p-3">Fonte</th><th className="p-3">Data</th><th className="p-3">Ação</th></tr></thead>
            <tbody>
              {data.active_alerts.map((alert: any) => (
                <tr key={alert.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 font-medium text-foreground">{alert.alert_type}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityColor(alert.severity)}`}>{alert.severity}</span></td>
                  <td className="p-3 text-muted-foreground max-w-[300px] truncate">{alert.message}</td>
                  <td className="p-3 text-xs text-muted-foreground">{alert.source}</td>
                  <td className="p-3 text-muted-foreground">{new Date(alert.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)} disabled={resolving === alert.id}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolver
                    </Button>
                  </td>
                </tr>
              ))}
              {data.active_alerts.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum alerta ativo ✓</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate Limit Events */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Ban className="h-4 w-4" /> Rate Limit Recentes ({data.recent_rate_limits.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Fonte</th><th className="p-3">Tipo</th><th className="p-3">Identificador</th><th className="p-3">IP</th><th className="p-3">Limite</th><th className="p-3">Contagem</th><th className="p-3">Bloqueado</th><th className="p-3">Data</th></tr></thead>
            <tbody>
              {data.recent_rate_limits.map((rl: any) => (
                <tr key={rl.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 text-foreground">{rl.event_source}</td>
                  <td className="p-3 text-muted-foreground">{rl.identifier_type}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{rl.identifier_value?.slice(0, 12)}...</td>
                  <td className="p-3 text-muted-foreground">{rl.ip_address || "—"}</td>
                  <td className="p-3 text-muted-foreground">{rl.limit_value}</td>
                  <td className="p-3 text-foreground font-semibold">{rl.current_count}</td>
                  <td className="p-3">{rl.blocked ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}</td>
                  <td className="p-3 text-muted-foreground">{new Date(rl.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {data.recent_rate_limits.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum evento de rate limit</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
  <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
    <Icon className={`h-6 w-6 ${color}`} />
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold capitalize ${color}`}>{value}</p>
    </div>
  </div>
);

const CounterCard = ({ icon: Icon, label, value, alert }: { icon: any; label: string; value: number; alert: boolean }) => (
  <div className={`rounded-xl border p-4 ${alert ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
  </div>
);
