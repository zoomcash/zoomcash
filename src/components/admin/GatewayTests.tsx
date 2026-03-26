import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Pagination, paginate } from "@/components/admin/Pagination";
import {
  Play, CheckCircle2, XCircle, AlertTriangle, Clock,
  FlaskConical, RefreshCw, Zap, Shield, Banknote,
  Repeat, GitBranch, Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BASE_URL = `${SUPABASE_URL}/functions/v1/gateway-test-runner`;

interface TestResult {
  id?: string;
  test_name: string;
  test_category?: string;
  status: "running" | "passed" | "failed" | "error";
  result: Record<string, unknown>;
  error_message?: string;
  duration_ms?: number;
  created_at?: string;
}

const TESTS = [
  { id: "simulate-payment", label: "Pagamento Aprovado", icon: Banknote, category: "payment", body: { result_type: "success" } },
  { id: "simulate-payment", label: "Pagamento Recusado", icon: XCircle, category: "payment", body: { result_type: "failed" }, key: "payment-failed" },
  { id: "idempotency", label: "Idempotência", icon: Repeat, category: "idempotency" },
  { id: "race-condition", label: "Race Condition", icon: Zap, category: "race_condition" },
  { id: "invalid-transition", label: "Transição Inválida", icon: GitBranch, category: "validation" },
  { id: "ledger-consistency", label: "Consistência Ledger", icon: Shield, category: "financial" },
  { id: "refund-negative-balance", label: "Refund Saldo Negativo", icon: Banknote, category: "financial", key: "refund-neg" },
  { id: "webhook-retry", label: "Webhook Retry", icon: Webhook, category: "webhook" },
];

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function GatewayTests() {
  const { session } = useAuth();
  const [running, setRunning] = useState(false);
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [history, setHistory] = useState<TestResult[]>([]);
  const [page, setPage] = useState(1);

  const callApi = useCallback(async (path: string, method = "POST", body?: unknown) => {
    if (!session?.access_token) throw new Error("Not authenticated");
    const res = await fetch(`${BASE_URL}/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }, [session?.access_token]);

  const runAllTests = async () => {
    setRunning(true);
    setResults([]);
    try {
      const data = await callApi("run-all");
      setResults(data.tests || []);
      toast.success(`Testes concluídos: ${data.summary.passed} ✓  ${data.summary.failed} ✗  ${data.summary.errors} ⚠`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  const runSingleTest = async (testId: string, body?: unknown, displayKey?: string) => {
    const key = displayKey || testId;
    setRunningTest(key);
    try {
      const data = await callApi(`run/${testId}`, "POST", body);
      setResults((prev) => {
        const filtered = prev.filter((r) => r.test_name !== data.test_name || JSON.stringify(r.result) !== JSON.stringify(data.result));
        return [data, ...filtered];
      });
      toast[data.status === "passed" ? "success" : "error"](`${data.test_name}: ${data.status}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunningTest(null);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await callApi("results", "GET");
      setHistory(data.data || []);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      passed: { bg: "bg-primary/20", text: "text-primary", label: "Aprovado" },
      failed: { bg: "bg-destructive/20", text: "text-destructive", label: "Falhou" },
      error: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Erro" },
      running: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Rodando" },
    };
    const s = map[status] || map.error;
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={runAllTests} disabled={running} className="gap-2">
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Executando..." : "Executar Todos"}
        </Button>
        <Button variant="outline" onClick={fetchHistory} className="gap-2">
          <Clock className="h-4 w-4" /> Histórico
        </Button>
      </div>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><FlaskConical className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Total</span></div>
            <p className="text-2xl font-bold text-foreground">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Aprovados</span></div>
            <p className="text-2xl font-bold text-primary">{summary.passed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><XCircle className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Falhos</span></div>
            <p className="text-2xl font-bold text-destructive">{summary.failed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-yellow-400" /><span className="text-xs text-muted-foreground">Erros</span></div>
            <p className="text-2xl font-bold text-yellow-400">{summary.errors}</p>
          </div>
        </div>
      )}

      {/* Individual Test Buttons */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Testes Individuais
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {TESTS.map((t) => {
            const key = t.key || t.id;
            const result = results.find(
              (r) => r.test_name === t.id.replace("-", "_") || r.test_name === "simulate_payment"
            );
            return (
              <button
                key={key}
                onClick={() => runSingleTest(t.id, t.body, key)}
                disabled={runningTest === key || running}
                className="flex items-center gap-2 rounded-lg border border-border p-3 text-left hover:bg-muted/30 transition-all disabled:opacity-50 group"
              >
                <t.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium text-foreground flex-1">{t.label}</span>
                {runningTest === key && <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Table */}
      {results.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Resultados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3">Teste</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duração</th>
                  <th className="p-3">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{r.test_name}</td>
                    <td className="p-3">{statusBadge(r.status)}</td>
                    <td className="p-3 text-muted-foreground">{r.duration_ms ? `${r.duration_ms}ms` : "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[300px]">
                      {r.error_message && <span className="text-destructive">{r.error_message}</span>}
                      {r.result?.reason && <span>{String(r.result.reason)}</span>}
                      {!r.error_message && !r.result?.reason && "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Table */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Histórico de Testes ({history.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3">Teste</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duração</th>
                  <th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {paginate(history, page).map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{r.test_name}</td>
                    <td className="p-3 text-muted-foreground">{r.test_category}</td>
                    <td className="p-3">{statusBadge(r.status)}</td>
                    <td className="p-3 text-muted-foreground">{r.duration_ms ? `${r.duration_ms}ms` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={history.length} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
