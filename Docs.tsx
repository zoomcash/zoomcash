import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import logoDreampay from "@/assets/logo-dreampay.png";
import {
  ChevronDown,
  Copy,
  Check,
  ArrowLeft,
  BookOpen,
  Key,
  Send,
  ArrowUpFromLine,
  Search,
  Bell,
  AlertTriangle,
  Info,
  ShieldAlert,
  Gauge,
  X,
} from "lucide-react";

/* ─── helpers ─── */
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

const CodeBlock = ({ label, children }: { label: string; children: string }) => (
  <div className="rounded-lg border border-border bg-secondary/40 overflow-hidden my-4">
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/60">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
    <div className="relative">
      <CopyButton text={children.trim()} />
      <pre className="p-4 pr-12 overflow-x-auto text-[12px] leading-relaxed font-mono-value text-foreground/90">
        <code>{children.trim()}</code>
      </pre>
    </div>
  </div>
);

const TabbedCode = ({ tabs }: { tabs: { label: string; code: string }[] }) => {
  const [active, setActive] = useState(0);
  return (
    <div className="rounded-lg border border-border bg-secondary/40 overflow-hidden my-4">
      <div className="flex items-center gap-0 border-b border-border bg-secondary/60 overflow-x-auto">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
              active === i
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <CopyButton text={tabs[active].code.trim()} />
        <pre className="p-4 pr-12 overflow-x-auto text-[12px] leading-relaxed font-mono-value text-foreground/90">
          <code>{tabs[active].code.trim()}</code>
        </pre>
      </div>
    </div>
  );
};

const MethodBadge = ({ method }: { method: "GET" | "POST" }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${
    method === "POST" ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary/70"
  }`}>
    {method}
  </span>
);

const Alert = ({ type, children }: { type: "warning" | "info"; children: React.ReactNode }) => (
  <div className={`rounded-lg border p-4 my-4 ${
    type === "warning"
      ? "border-destructive/30 bg-destructive/5"
      : "border-primary/30 bg-primary/5"
  }`}>
    <div className="flex items-start gap-2.5">
      {type === "warning"
        ? <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        : <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      }
      <div className="text-[13px] text-foreground/80 leading-relaxed">{children}</div>
    </div>
  </div>
);

const ParamTable = ({ params }: { params: { name: string; type: string; desc: string; required?: boolean }[] }) => (
  <div className="overflow-x-auto my-4 rounded-lg border border-border">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border bg-secondary/40">
          <th className="text-left px-4 py-2.5 font-semibold text-foreground">Parâmetro</th>
          <th className="text-left px-4 py-2.5 font-semibold text-foreground">Tipo</th>
          <th className="text-left px-4 py-2.5 font-semibold text-foreground">Descrição</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p) => (
          <tr key={p.name} className="border-b border-border/50 last:border-0">
            <td className="px-4 py-2.5 font-mono-value text-primary/90">
              {p.name}{p.required !== false && <span className="text-destructive ml-0.5">*</span>}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">{p.type}</td>
            <td className="px-4 py-2.5 text-foreground/80">{p.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StatusTable = ({ items }: { items: { status: string; desc: string }[] }) => (
  <div className="overflow-x-auto my-4 rounded-lg border border-border">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border bg-secondary/40">
          <th className="text-left px-4 py-2.5 font-semibold text-foreground">Status</th>
          <th className="text-left px-4 py-2.5 font-semibold text-foreground">Descrição</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.status} className="border-b border-border/50 last:border-0">
            <td className="px-4 py-2.5 font-mono-value text-primary/90">{i.status}</td>
            <td className="px-4 py-2.5 text-foreground/80">{i.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ─── sidebar nav data ─── */
const sections = [
  {
    group: "Começando",
    icon: BookOpen,
    items: [
      { id: "visao-geral", label: "Visão Geral" },
      { id: "autenticacao", label: "Autenticação" },
    ],
  },
  {
    group: "Referência da API",
    icon: Key,
    items: [
      { id: "gerar-transacao", label: "Gerar Transação" },
      { id: "transferencia-interna", label: "Transferência Interna" },
      { id: "consultar-saldo", label: "Consultar Saldo" },
      { id: "solicitar-saque", label: "Solicitar Saque" },
      { id: "verificar-transacao", label: "Verificar Transação" },
    ],
  },
  {
    group: "Webhooks",
    icon: Bell,
    items: [
      { id: "webhook-deposito", label: "Webhook de Depósito" },
      { id: "webhook-saque", label: "Webhook de Saque" },
    ],
  },
  {
    group: "Erros & Limites",
    icon: ShieldAlert,
    items: [
      { id: "codigos-erro", label: "Códigos de Erro" },
      { id: "rate-limits", label: "Rate Limits" },
    ],
  },
  {
    group: "Exemplos",
    icon: Gauge,
    items: [
      { id: "exemplo-javascript", label: "JavaScript / Node.js" },
      { id: "exemplo-python", label: "Python" },
    ],
  },
];

const BASE_URL = "https://api.dreampay.com";

const Docs = () => {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(
    sections.map((s) => s.group)
  );
  const [activeSection, setActiveSection] = useState("visao-geral");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleGroup = (g: string) =>
    setExpandedGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    setSearchQuery("");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.id.toLowerCase().includes(q) ||
            s.group.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [searchQuery]);

  useEffect(() => {
    const ids = sections.flatMap((s) => s.items.map((i) => i.id));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border shrink-0">
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src={logoDreampay} alt="DreamPay" className="h-6 w-6 rounded-md" />
          <span className="text-[14px] font-bold tracking-tight">
            <span className="text-primary">Dream</span>
            <span className="text-foreground">Pay</span>
          </span>
        </Link>
        <span className="text-muted-foreground/40 mx-1.5">|</span>
        <span className="text-[12px] text-muted-foreground font-medium">Docs</span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar na documentação..."
            className="w-full rounded-md border border-border bg-secondary/40 pl-8 pr-8 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {filteredSections.length === 0 && (
          <p className="text-[11px] text-muted-foreground/60 px-3 py-4 text-center">Nenhum resultado encontrado</p>
        )}
        {filteredSections.map((section) => {
          const isExpanded = expandedGroups.includes(section.group) || searchQuery.trim().length > 0;
          return (
            <div key={section.group}>
              <button
                onClick={() => toggleGroup(section.group)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold text-foreground/80 hover:text-foreground transition-colors"
              >
                <section.icon className="h-3.5 w-3.5 opacity-50" />
                <span className="flex-1 text-left">{section.group}</span>
                <ChevronDown className={`h-3 w-3 opacity-40 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border/40 pl-3">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollTo(item.id)}
                      className={`block w-full text-left rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                        activeSection === item.id
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Back link */}
      <div className="border-t border-border px-4 py-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-12 bg-background/95 backdrop-blur border-b border-border flex items-center px-4 gap-3">
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="text-muted-foreground hover:text-foreground">
          <BookOpen className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-semibold text-foreground">
          <span className="text-primary">Flux</span>Pay Docs
        </span>
      </div>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[260px] bg-background border-r border-border shadow-2xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[220px] md:flex-col md:fixed md:inset-y-0 bg-background border-r border-border">
        {sidebar}
      </aside>

      {/* Content */}
      <main ref={contentRef} className="md:pl-[220px] pt-14 md:pt-0">
        <div className="max-w-4xl mx-auto px-6 py-10 md:py-14 space-y-16">

          {/* ═══ Visão Geral ═══ */}
          <section id="visao-geral">
            <h1 className="text-3xl font-extrabold text-foreground mb-3">Visão Geral</h1>
            <p className="text-[15px] text-foreground/70 leading-relaxed mb-8">
              A <strong className="text-foreground">DreamPay</strong> é uma API completa de pagamentos que permite receber e enviar pagamentos via PIX de forma simples e segura. Nossa plataforma oferece:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Send, title: "Receber Pagamentos (Cash-In)", desc: "Gere QR Codes PIX e receba pagamentos de seus clientes instantaneamente" },
                { icon: ArrowUpFromLine, title: "Realizar Saques (Cash-Out)", desc: "Transfira fundos para qualquer chave PIX de forma programática" },
                { icon: Bell, title: "Webhooks em Tempo Real", desc: "Receba notificações automáticas de mudanças de status em suas transações" },
              ].map((card) => (
                <div key={card.title} className="rounded-xl border border-border bg-card p-5 card-hover">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <card.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-[14px] font-bold text-foreground mb-1">{card.title}</h3>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

            <Alert type="info">
              <strong>Versão da API:</strong> Esta documentação refere-se à API v1. Todas as requisições devem ser feitas para o endpoint base: <code className="font-mono-value text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[12px]">{BASE_URL}</code>
            </Alert>
          </section>

          {/* ═══ Autenticação ═══ */}
          <section id="autenticacao">
            <h2 className="text-2xl font-bold text-foreground mb-3">Autenticação</h2>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              A API da DreamPay utiliza autenticação baseada em <strong className="text-foreground">Client ID + Client Secret</strong>. Cada requisição deve incluir dois headers essenciais.
            </p>

            <Alert type="warning">
              Nunca exponha sua Client Secret no frontend ou em repositórios públicos. Ela deve ser armazenada de forma segura no backend.
            </Alert>

            <h3 className="text-lg font-bold text-foreground mt-8 mb-2">URL Base da API</h3>
            <p className="text-[13px] text-foreground/70 mb-3">Todas as requisições devem ser enviadas para a seguinte URL base:</p>
            <CodeBlock label="URL Base">{`${BASE_URL}/api`}</CodeBlock>

            <h3 className="text-lg font-bold text-foreground mt-8 mb-2">Headers Obrigatórios</h3>
            <CodeBlock label="Headers HTTP">{`ci: seu_client_id
cs: seu_client_secret
Content-Type: application/json`}</CodeBlock>
          </section>

          {/* ═══ Gerar Transação ═══ */}
          <section id="gerar-transacao">
            <div className="flex items-center gap-3 mb-3">
              <MethodBadge method="POST" />
              <h2 className="text-2xl font-bold text-foreground">/api/transactions/create</h2>
            </div>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Cria uma nova transação PIX para receber pagamento de um cliente. Retorna QR Code e dados da transação.
            </p>

            <h3 className="text-base font-bold text-foreground mb-2">Parâmetros</h3>
            <ParamTable params={[
              { name: "amount", type: "number", desc: "Valor em reais. Ex: 4.55 = R$ 4,55" },
              { name: "payerName", type: "string", desc: "Nome do pagador da transação" },
              { name: "payerDocument", type: "string", desc: "CPF do pagador (sem formatação)" },
              { name: "transactionId", type: "string", desc: "ID da sua aplicação para identificação" },
              { name: "description", type: "string", desc: "Descrição do pagamento" },
              { name: "projectWebhook", type: "string", desc: "URL do webhook (opcional)", required: false },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplos de Requisição</h3>
            <TabbedCode tabs={[
              {
                label: "cURL",
                code: `curl -X POST '${BASE_URL}/api/transactions/create' \\
  --header 'ci: seu_client_id' \\
  --header 'cs: seu_client_secret' \\
  --header 'Content-Type: application/json' \\
  --data '{
  "amount": 5,
  "payerName": "Nome do cliente",
  "payerDocument": "12345678909",
  "transactionId": "id_da_sua_aplicacao",
  "description": "Pagamento do cliente"
}'`,
              },
              {
                label: "JavaScript",
                code: `const response = await fetch('${BASE_URL}/api/transactions/create', {
  method: 'POST',
  headers: {
    'ci': 'seu_client_id',
    'cs': 'seu_client_secret',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 5,
    payerName: 'Nome do cliente',
    payerDocument: '12345678909',
    transactionId: 'id_da_sua_aplicacao',
    description: 'Pagamento do cliente',
  }),
});

const data = await response.json();
console.log(data);`,
              },
              {
                label: "Python",
                code: `import requests

response = requests.post(
    '${BASE_URL}/api/transactions/create',
    headers={
        'ci': 'seu_client_id',
        'cs': 'seu_client_secret',
        'Content-Type': 'application/json',
    },
    json={
        'amount': 5,
        'payerName': 'Nome do cliente',
        'payerDocument': '12345678909',
        'transactionId': 'id_da_sua_aplicacao',
        'description': 'Pagamento do cliente',
    },
)

print(response.json())`,
              },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplo de Resposta</h3>
            <CodeBlock label="JSON">{`{
  "message": "Transação criada com sucesso",
  "data": {
    "transactionId": "31484480",
    "payer": {
      "name": "Nome do cliente",
      "document": "12345678909"
    },
    "transactionFee": 23,
    "transactionType": "DEPOSITO",
    "transactionMethod": "PIX",
    "transactionAmount": 455,
    "transactionState": "PENDENTE",
    "qrCodeBase64": "data:image/png;base64,...",
    "qrcodeUrl": "https://api.qrserver.com/...",
    "copyPaste": "00020101021226..."
  }
}`}</CodeBlock>
          </section>

          {/* ═══ Transferência Interna ═══ */}
          <section id="transferencia-interna">
            <div className="flex items-center gap-3 mb-3">
              <MethodBadge method="POST" />
              <h2 className="text-2xl font-bold text-foreground">/api/transactions/internal</h2>
            </div>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Cria uma transação interna vinculada a um usuário pelo e-mail.
            </p>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplos de Requisição</h3>
            <TabbedCode tabs={[
              {
                label: "cURL",
                code: `curl -X POST '${BASE_URL}/api/transactions/internal' \\
  --header 'ci: seu_client_id' \\
  --header 'cs: seu_client_secret' \\
  --header 'Content-Type: application/json' \\
  --data '{
  "email": "recebedor@gmail.com",
  "amount": 2,
  "description": "Transferência interna"
}'`,
              },
              {
                label: "JavaScript",
                code: `const response = await fetch('${BASE_URL}/api/transactions/internal', {
  method: 'POST',
  headers: {
    'ci': 'seu_client_id',
    'cs': 'seu_client_secret',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'recebedor@gmail.com',
    amount: 2,
    description: 'Transferência interna',
  }),
});

const data = await response.json();`,
              },
              {
                label: "Python",
                code: `import requests

response = requests.post(
    '${BASE_URL}/api/transactions/internal',
    headers={
        'ci': 'seu_client_id',
        'cs': 'seu_client_secret',
        'Content-Type': 'application/json',
    },
    json={
        'email': 'recebedor@gmail.com',
        'amount': 2,
        'description': 'Transferência interna',
    },
)

print(response.json())`,
              },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplo de Resposta</h3>
            <CodeBlock label="JSON">{`{
  "message": "Transferência realizada com sucesso",
  "data": {
    "transactionId": "id-da-transacao",
    "amount": 2,
    "recipientEmail": "recebedor@gmail.com",
    "recipientName": "Nome do recebedor",
    "newBalance": 150.00
  }
}`}</CodeBlock>
          </section>

          {/* ═══ Consultar Saldo ═══ */}
          <section id="consultar-saldo">
            <div className="flex items-center gap-3 mb-3">
              <MethodBadge method="GET" />
              <h2 className="text-2xl font-bold text-foreground">/api/users/balance</h2>
            </div>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Retorna o saldo disponível na conta.
            </p>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplos de Requisição</h3>
            <TabbedCode tabs={[
              {
                label: "cURL",
                code: `curl -X GET '${BASE_URL}/api/users/balance' \\
  --header 'ci: seu_client_id' \\
  --header 'cs: seu_client_secret'`,
              },
              {
                label: "JavaScript",
                code: `const response = await fetch('${BASE_URL}/api/users/balance', {
  headers: {
    'ci': 'seu_client_id',
    'cs': 'seu_client_secret',
  },
});

const data = await response.json();
console.log('Saldo:', data.data.balance);`,
              },
              {
                label: "Python",
                code: `import requests

response = requests.get(
    '${BASE_URL}/api/users/balance',
    headers={
        'ci': 'seu_client_id',
        'cs': 'seu_client_secret',
    },
)

print('Saldo:', response.json()['data']['balance'])`,
              },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplo de Resposta</h3>
            <CodeBlock label="JSON">{`{
  "message": "Saldo do usuário obtido com sucesso",
  "data": {
    "balance": 150.00
  }
}`}</CodeBlock>
          </section>

          {/* ═══ Solicitar Saque ═══ */}
          <section id="solicitar-saque">
            <div className="flex items-center gap-3 mb-3">
              <MethodBadge method="POST" />
              <h2 className="text-2xl font-bold text-foreground">/api/transactions/withdraw</h2>
            </div>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Solicita um saque via PIX para uma chave PIX. O valor será debitado do saldo disponível.
            </p>

            <h3 className="text-base font-bold text-foreground mb-2">Parâmetros</h3>
            <ParamTable params={[
              { name: "amount", type: "number", desc: "Valor em reais. Ex: 100 = R$ 100,00" },
              { name: "pixKey", type: "string", desc: "Chave PIX do destinatário (sem formatação)" },
              { name: "pixKeyType", type: "string", desc: '"CPF", "CNPJ", "EMAIL", "TELEFONE", "CHAVE_ALEATORIA"' },
              { name: "description", type: "string", desc: "Descrição do pagamento" },
              { name: "projectWebhook", type: "string", desc: "URL do webhook (opcional)", required: false },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplos de Requisição</h3>
            <TabbedCode tabs={[
              {
                label: "cURL",
                code: `curl -X POST '${BASE_URL}/api/transactions/withdraw' \\
  --header 'ci: seu_client_id' \\
  --header 'cs: seu_client_secret' \\
  --header 'Content-Type: application/json' \\
  --data '{
  "amount": 100,
  "pixKey": "12345678909",
  "pixKeyType": "CPF",
  "description": "Saque via API"
}'`,
              },
              {
                label: "JavaScript",
                code: `const response = await fetch('${BASE_URL}/api/transactions/withdraw', {
  method: 'POST',
  headers: {
    'ci': 'seu_client_id',
    'cs': 'seu_client_secret',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 100,
    pixKey: '12345678909',
    pixKeyType: 'CPF',
    description: 'Saque via API',
  }),
});

const data = await response.json();`,
              },
              {
                label: "Python",
                code: `import requests

response = requests.post(
    '${BASE_URL}/api/transactions/withdraw',
    headers={
        'ci': 'seu_client_id',
        'cs': 'seu_client_secret',
        'Content-Type': 'application/json',
    },
    json={
        'amount': 100,
        'pixKey': '12345678909',
        'pixKeyType': 'CPF',
        'description': 'Saque via API',
    },
)

print(response.json())`,
              },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplo de Resposta</h3>
            <CodeBlock label="JSON">{`{
  "message": "Saque adicionado à fila de processamento",
  "data": {
    "transactionId": "54345",
    "status": "QUEUED",
    "message": "Seu saque será processado em breve"
  }
}`}</CodeBlock>
          </section>

          {/* ═══ Verificar Transação ═══ */}
          <section id="verificar-transacao">
            <div className="flex items-center gap-3 mb-3">
              <MethodBadge method="POST" />
              <h2 className="text-2xl font-bold text-foreground">/api/transactions/check</h2>
            </div>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Consulte o status e detalhes de uma transação específica.
            </p>

            <Alert type="warning">
              <strong>Rate Limit:</strong> Esta rota possui limite de 60 requisições por minuto por IP. Requisições que excederem retornarão erro 429.
            </Alert>

            <h3 className="text-base font-bold text-foreground mb-2">Parâmetros</h3>
            <ParamTable params={[
              { name: "transactionId", type: "string | number", desc: "ID da transação a ser verificada" },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplos de Requisição</h3>
            <TabbedCode tabs={[
              {
                label: "cURL",
                code: `curl -X POST '${BASE_URL}/api/transactions/check' \\
  --header 'ci: seu_client_id' \\
  --header 'cs: seu_client_secret' \\
  --header 'Content-Type: application/json' \\
  --data '{
  "transactionId": "54345"
}'`,
              },
              {
                label: "JavaScript",
                code: `const response = await fetch('${BASE_URL}/api/transactions/check', {
  method: 'POST',
  headers: {
    'ci': 'seu_client_id',
    'cs': 'seu_client_secret',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ transactionId: '54345' }),
});

const data = await response.json();
console.log('Status:', data.transaction.transactionState);`,
              },
              {
                label: "Python",
                code: `import requests

response = requests.post(
    '${BASE_URL}/api/transactions/check',
    headers={
        'ci': 'seu_client_id',
        'cs': 'seu_client_secret',
        'Content-Type': 'application/json',
    },
    json={'transactionId': '54345'},
)

print('Status:', response.json()['transaction']['transactionState'])`,
              },
            ]} />

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Exemplo de Resposta</h3>
            <CodeBlock label="JSON">{`{
  "message": "Transação encontrada com sucesso!",
  "transaction": {
    "transactionId": "301124932",
    "value": 1.12,
    "fee": 0.31,
    "transactionState": "COMPLETO",
    "transactionType": "DEPOSITO",
    "transactionMethod": "PIX",
    "createdAt": "2025-12-02T01:20:18.475Z",
    "updatedAt": "2025-12-02T01:20:53.002Z"
  }
}`}</CodeBlock>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Status Possíveis</h3>
            <StatusTable items={[
              { status: "PENDENTE", desc: "Transação pendente, aguardando pagamento" },
              { status: "COMPLETO", desc: "Transação aprovada e concluída com sucesso" },
              { status: "FALHA", desc: "Transação falhou ou foi rejeitada" },
            ]} />
          </section>

          {/* ═══ Webhook de Depósito ═══ */}
          <section id="webhook-deposito">
            <h2 className="text-2xl font-bold text-foreground mb-3">Webhook de Depósito</h2>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Webhooks são notificações automáticas enviadas pela DreamPay quando há mudanças no status de transações. São requisições <strong className="text-foreground">HTTP POST</strong> enviadas para a URL configurada.
            </p>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Estrutura do Webhook</h3>
            <CodeBlock label="JSON">{`{
  "transactionId": 31484480,
  "transactionType": "DEPOSITO",
  "transactionMethod": "PIX",
  "clientName": "Nome do cliente",
  "clientDocument": "12345678909",
  "status": "COMPLETO",
  "value": 455,
  "fee": 23
}`}</CodeBlock>
          </section>

          {/* ═══ Webhook de Saque ═══ */}
          <section id="webhook-saque">
            <h2 className="text-2xl font-bold text-foreground mb-3">Webhook de Saque</h2>

            <h3 className="text-base font-bold text-foreground mt-4 mb-2">Estrutura do Webhook</h3>
            <CodeBlock label="JSON">{`{
  "transactionId": 31484480,
  "transactionType": "RETIRADA",
  "transactionMethod": "PIX",
  "clientName": "Nome do cliente",
  "clientDocument": "12345678909",
  "status": "COMPLETO",
  "value": 455,
  "fee": 23
}`}</CodeBlock>
          </section>

          {/* ═══ Códigos de Erro ═══ */}
          <section id="codigos-erro">
            <h2 className="text-2xl font-bold text-foreground mb-3">Códigos de Erro</h2>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              A API retorna códigos HTTP padrão para indicar sucesso ou falha. Todas as respostas de erro seguem a mesma estrutura JSON.
            </p>

            <CodeBlock label="Estrutura de Erro">{`{
  "error": "invalid_request",
  "message": "Descrição detalhada do erro",
  "statusCode": 400
}`}</CodeBlock>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Códigos HTTP</h3>
            <div className="overflow-x-auto my-4 rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Código</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Tipo</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: "200", type: "OK", desc: "Requisição processada com sucesso" },
                    { code: "201", type: "Created", desc: "Recurso criado com sucesso" },
                    { code: "400", type: "Bad Request", desc: "Parâmetros inválidos ou ausentes na requisição" },
                    { code: "401", type: "Unauthorized", desc: "Client ID ou Client Secret inválidos" },
                    { code: "403", type: "Forbidden", desc: "Sem permissão para acessar o recurso" },
                    { code: "404", type: "Not Found", desc: "Recurso não encontrado" },
                    { code: "409", type: "Conflict", desc: "Conflito — recurso já existe ou ação duplicada" },
                    { code: "422", type: "Unprocessable", desc: "Dados válidos mas semanticamente incorretos" },
                    { code: "429", type: "Too Many Requests", desc: "Rate limit excedido. Aguarde antes de tentar novamente" },
                    { code: "500", type: "Internal Error", desc: "Erro interno do servidor. Tente novamente mais tarde" },
                  ].map((row) => (
                    <tr key={row.code} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-mono-value text-primary/90">{row.code}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{row.type}</td>
                      <td className="px-4 py-2.5 text-foreground/80">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Erros Comuns</h3>
            <div className="space-y-3 my-4">
              {[
                { error: "invalid_credentials", desc: "Headers ci ou cs ausentes ou inválidos. Verifique suas credenciais." },
                { error: "insufficient_balance", desc: "Saldo insuficiente para realizar a operação." },
                { error: "invalid_pix_key", desc: "Chave PIX inválida ou formato incorreto." },
                { error: "transaction_not_found", desc: "Transação não encontrada com o ID informado." },
                { error: "duplicate_transaction", desc: "Já existe uma transação com este ID." },
                { error: "rate_limit_exceeded", desc: "Número de requisições excedido. Aguarde 1 minuto." },
              ].map((e) => (
                <div key={e.error} className="rounded-lg border border-border bg-card p-4">
                  <code className="font-mono-value text-[12px] text-destructive">{e.error}</code>
                  <p className="text-[12px] text-muted-foreground mt-1">{e.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ Rate Limits ═══ */}
          <section id="rate-limits">
            <h2 className="text-2xl font-bold text-foreground mb-3">Rate Limits</h2>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              A API da DreamPay aplica limites de requisições para garantir estabilidade e performance. Os limites variam por rota e são aplicados por IP e por credencial.
            </p>

            <div className="overflow-x-auto my-4 rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Rota</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Limite</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-foreground">Janela</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { route: "/api/transactions/create", limit: "120 req", window: "por minuto" },
                    { route: "/api/transactions/withdraw", limit: "60 req", window: "por minuto" },
                    { route: "/api/transactions/internal", limit: "60 req", window: "por minuto" },
                    { route: "/api/transactions/check", limit: "60 req", window: "por minuto" },
                    { route: "/api/users/balance", limit: "120 req", window: "por minuto" },
                  ].map((r) => (
                    <tr key={r.route} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-mono-value text-primary/90 text-[11px]">{r.route}</td>
                      <td className="px-4 py-2.5 text-foreground font-medium">{r.limit}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.window}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Alert type="info">
              Quando o limite é excedido, a API retorna <code className="font-mono-value text-primary bg-primary/10 px-1 py-0.5 rounded text-[11px]">429 Too Many Requests</code>. O header <code className="font-mono-value text-primary bg-primary/10 px-1 py-0.5 rounded text-[11px]">Retry-After</code> indica quantos segundos aguardar.
            </Alert>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Headers de Rate Limit na Resposta</h3>
            <CodeBlock label="Headers">{`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709312400
Retry-After: 30`}</CodeBlock>

            <h3 className="text-base font-bold text-foreground mt-6 mb-2">Boas Práticas</h3>
            <ul className="space-y-2 my-4">
              {[
                "Implemente retry com backoff exponencial para erros 429",
                "Cache respostas de consulta de saldo por pelo menos 5 segundos",
                "Use webhooks ao invés de polling para acompanhar status de transações",
                "Agrupe transações em lotes quando possível",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground/80">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </section>

          {/* ═══ Exemplo JavaScript ═══ */}
          <section id="exemplo-javascript">
            <h2 className="text-2xl font-bold text-foreground mb-3">Exemplo Completo — JavaScript / Node.js</h2>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Um exemplo completo de integração usando JavaScript com tratamento de erros e retry automático.
            </p>

            <CodeBlock label="JavaScript / Node.js">{`class DreamPayClient {
  constructor(clientId, clientSecret) {
    this.baseUrl = '${BASE_URL}/api';
    this.headers = {
      'ci': clientId,
      'cs': clientSecret,
      'Content-Type': 'application/json',
    };
  }

  async request(method, path, body = null) {
    const options = { method, headers: this.headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(\`\${this.baseUrl}\${path}\`, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 30;
      console.log(\`Rate limit atingido. Aguardando \${retryAfter}s...\`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return this.request(method, path, body);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(\`[\${response.status}] \${error.message}\`);
    }

    return response.json();
  }

  // Criar transação PIX
  async createTransaction({ amount, payerName, payerDocument, transactionId, description }) {
    return this.request('POST', '/transactions/create', {
      amount, payerName, payerDocument, transactionId, description,
    });
  }

  // Consultar saldo
  async getBalance() {
    return this.request('GET', '/users/balance');
  }

  // Solicitar saque
  async withdraw({ amount, pixKey, pixKeyType, description }) {
    return this.request('POST', '/transactions/withdraw', {
      amount, pixKey, pixKeyType, description,
    });
  }

  // Verificar transação
  async checkTransaction(transactionId) {
    return this.request('POST', '/transactions/check', { transactionId });
  }
}

// Uso:
const client = new DreamPayClient('seu_client_id', 'seu_client_secret');

const tx = await client.createTransaction({
  amount: 49.90,
  payerName: 'João Silva',
  payerDocument: '12345678909',
  transactionId: 'pedido-001',
  description: 'Pagamento Pedido #001',
});

console.log('QR Code:', tx.data.qrcodeUrl);
console.log('Copia e Cola:', tx.data.copyPaste);`}</CodeBlock>
          </section>

          {/* ═══ Exemplo Python ═══ */}
          <section id="exemplo-python">
            <h2 className="text-2xl font-bold text-foreground mb-3">Exemplo Completo — Python</h2>
            <p className="text-[14px] text-foreground/70 leading-relaxed mb-4">
              Um exemplo completo de integração usando Python com a biblioteca <code className="font-mono-value text-primary bg-primary/10 px-1 py-0.5 rounded text-[11px]">requests</code>.
            </p>

            <CodeBlock label="Python">{`import requests
import time


class DreamPayClient:
    def __init__(self, client_id: str, client_secret: str):
        self.base_url = '${BASE_URL}/api'
        self.headers = {
            'ci': client_id,
            'cs': client_secret,
            'Content-Type': 'application/json',
        }

    def _request(self, method: str, path: str, json_data=None):
        url = f'{self.base_url}{path}'
        response = requests.request(method, url, headers=self.headers, json=json_data)

        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 30))
            print(f'Rate limit atingido. Aguardando {retry_after}s...')
            time.sleep(retry_after)
            return self._request(method, path, json_data)

        response.raise_for_status()
        return response.json()

    def create_transaction(self, amount, payer_name, payer_document, transaction_id, description):
        return self._request('POST', '/transactions/create', {
            'amount': amount,
            'payerName': payer_name,
            'payerDocument': payer_document,
            'transactionId': transaction_id,
            'description': description,
        })

    def get_balance(self):
        return self._request('GET', '/users/balance')

    def withdraw(self, amount, pix_key, pix_key_type, description):
        return self._request('POST', '/transactions/withdraw', {
            'amount': amount,
            'pixKey': pix_key,
            'pixKeyType': pix_key_type,
            'description': description,
        })

    def check_transaction(self, transaction_id):
        return self._request('POST', '/transactions/check', {
            'transactionId': transaction_id,
        })


# Uso:
client = DreamPayClient('seu_client_id', 'seu_client_secret')

tx = client.create_transaction(
    amount=49.90,
    payer_name='João Silva',
    payer_document='12345678909',
    transaction_id='pedido-001',
    description='Pagamento Pedido #001',
)

print('QR Code:', tx['data']['qrcodeUrl'])
print('Copia e Cola:', tx['data']['copyPaste'])

# Consultar saldo
balance = client.get_balance()
print('Saldo:', balance['data']['balance'])`}</CodeBlock>
          </section>

          {/* Footer */}
          <div className="border-t border-border pt-8 pb-16 text-center">
            <p className="text-[12px] text-muted-foreground">
              © {new Date().getFullYear()} DreamPay. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Docs;
