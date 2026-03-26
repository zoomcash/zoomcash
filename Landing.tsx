import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Eye, Smartphone, Sparkles, Lock, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/useCountUp";
import logoDreampay from "@/assets/logo-dreampay.png";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const stats = [
  { num: 87, suffix: "+", label: "Clientes ativos", desc: "Negócios que já utilizam a plataforma" },
  { num: 380, prefix: "R$ ", suffix: "K+", label: "Movimentado", desc: "Processados com segurança no último mês" },
  { num: 99.5, suffix: "%", label: "Uptime", desc: "Servidores estáveis com monitoramento" },
];

const features = [
  { icon: Zap, title: "Pagamentos instantâneos", desc: "Receba e envie via Pix em segundos, sem burocracia" },
  { icon: Shield, title: "Blindagem anti-fraude", desc: "Camadas de verificação e criptografia para cada operação" },
  { icon: Lock, title: "Dados sob controle", desc: "Armazenamento seguro e conformidade com LGPD" },
  { icon: Eye, title: "Painel em tempo real", desc: "Acompanhe entradas, saídas e métricas ao vivo" },
  { icon: Smartphone, title: "Acesso em qualquer tela", desc: "Responsivo e otimizado para qualquer dispositivo" },
  { icon: Sparkles, title: "Integração simples", desc: "API documentada para conectar ao seu sistema" },
];

const AnimatedStat = ({ stat }: { stat: typeof stats[number] }) => {
  const isDecimal = stat.num % 1 !== 0;
  const { count, ref } = useCountUp(isDecimal ? Math.round(stat.num * 10) : stat.num, 2000);
  const display = isDecimal ? (count / 10).toFixed(1) : count;
  return (
    <p ref={ref as React.Ref<HTMLParagraphElement>} className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground font-mono leading-none">
      {stat.prefix || ""}{display}{stat.suffix}
    </p>
  );
};

const FloatingDots = () => {
  const dots = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1.5,
      duration: Math.random() * 25 + 20,
      delay: Math.random() * -30,
      opacity: Math.random() * 0.25 + 0.08,
      dx: (Math.random() - 0.5) * 30,
      dy: (Math.random() - 0.5) * 30,
    })), []);

  return (
    <>
      <style>{`
        @keyframes float-dot {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(var(--dx), calc(var(--dy) * -1)); }
          50% { transform: translate(calc(var(--dx) * -0.5), var(--dy)); }
          75% { transform: translate(calc(var(--dx) * 0.7), calc(var(--dy) * 0.3)); }
        }
      `}</style>
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="absolute rounded-full bg-primary"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            opacity: dot.opacity,
            '--dx': `${dot.dx}px`,
            '--dy': `${dot.dy}px`,
            animation: `float-dot ${dot.duration}s ease-in-out ${dot.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
};

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Grid background effect */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle noise texture via tiny scattered dots */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, hsl(155 72% 46% / 0.08) 0%, transparent 50%),
              radial-gradient(circle at 75% 15%, hsl(155 72% 46% / 0.05) 0%, transparent 40%),
              radial-gradient(circle at 60% 75%, hsl(155 72% 46% / 0.04) 0%, transparent 45%)
            `,
          }}
        />
        {/* Vignette edges */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(220_20%_4%/0.6)_100%)]" />
        <FloatingDots />
      </div>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-lg relative">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoDreampay} alt="DreamPay" className="h-7 w-7 rounded-lg" />
            <span className="text-base font-extrabold tracking-tight">
              <span className="text-primary">Dream</span>
              <span className="text-foreground">Pay</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {["Recursos", "Preços", "Sobre", "Contato"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
          <Link to="/auth">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 h-9 text-sm font-semibold">
              Iniciar Sessão
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10">
        <div className="container py-24 md:py-36 text-center">
          <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-2xl mx-auto space-y-5">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Gateway de pagamentos Pix automatizado
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] leading-[1.15] font-extrabold tracking-tight"
            >
              Automatize seus{" "}
              <span className="text-primary">pagamentos Pix</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
              Receba e envie pagamentos Pix de forma automática com taxas reduzidas. Integração rápida, painel completo e suporte dedicado.
            </motion.p>
            <motion.div variants={fadeUp} className="pt-2">
              <Link to="/auth">
                <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-7 h-12 text-sm font-bold transition-colors">
                  Começar gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border relative z-10">
        <div className="container py-14 md:py-16">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid grid-cols-3 gap-0 divide-x divide-border"
          >
            {stats.map((stat) => (
              <motion.div key={stat.label} variants={fadeUp} className="text-center px-4 md:px-8">
                <AnimatedStat stat={stat} />
                <p className="text-[11px] md:text-xs font-semibold text-primary mt-2.5 uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {stat.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="bg-card/30 relative z-10">
        <div className="container py-16 md:py-24 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="space-y-3 mb-12">
            <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Preços transparentes
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground max-w-md mx-auto text-sm">
              Zero mensalidade. Pague somente por transação realizada
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto"
          >
            {[
              { tag: "Recebimento", price: "R$ 0,45", desc: "Cobranças Pix geradas automaticamente. Confirmação instantânea via webhook" },
              { tag: "Envio", price: "R$ 0,30", desc: "Saques e transferências processados na hora com rastreamento completo" },
            ].map((plan) => (
              <motion.div
                key={plan.tag}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card p-6 text-left hover:border-primary/30 transition-colors"
              >
                <span className="inline-block rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                  {plan.tag}
                </span>
                <p className="text-[10px] text-muted-foreground mt-4 uppercase tracking-wider font-medium">A partir de</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">por transação</span>
                </p>
                <p className="text-sm text-muted-foreground mt-3">{plan.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="flex flex-wrap justify-center gap-3 mt-10">
            <Link to="/auth">
              <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-7 h-11 font-semibold transition-colors">
                Criar conta grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth?redirect=/dashboard">
              <Button variant="outline" size="lg" className="gap-2 rounded-lg px-7 h-11 font-semibold border-border text-foreground hover:border-primary/40 hover:text-primary transition-colors">
                Ver dashboard
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="relative z-10">
        <div className="container py-16 md:py-24">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="space-y-3 mb-12">
            <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Tudo que você precisa
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground max-w-md text-sm">
              Ferramentas para gerenciar suas finanças com eficiência
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card/50 p-6 text-left hover:border-primary/20 transition-colors"
              >
                <div className="rounded-lg bg-primary/10 p-2 w-fit mb-4">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* About */}
      <section id="sobre" className="bg-card/30 relative z-10">
        <div className="container py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
              <motion.p variants={fadeUp} className="text-sm font-semibold text-primary mb-3">Quem somos</motion.p>
              <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                Infraestrutura pensada para escalar
              </motion.h2>
              <motion.p variants={fadeUp} className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
                A DreamPay nasceu para resolver a dor de quem precisa receber e enviar Pix em volume. API robusta, painel intuitivo e suporte que responde de verdade.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-6">
                <Link to="/auth">
                  <Button variant="outline" className="gap-2 rounded-lg px-6 h-10 border-border text-foreground hover:border-primary/40 hover:text-primary font-medium transition-colors">
                    Saiba mais
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-sm font-bold text-foreground mb-5">Benefícios principais</h3>
              <div className="space-y-5">
                {[
                  { icon: Shield, title: "Anti-fraude integrado", desc: "Validações automáticas em cada transação" },
                  { icon: Zap, title: "Confirmação em segundos", desc: "Webhook notifica seu sistema assim que o Pix cai" },
                  { icon: Eye, title: "Relatórios detalhados", desc: "Exporte e filtre transações por período ou status" },
                ].map((b) => (
                  <div key={b.title} className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 mt-0.5 shrink-0">
                      <b.icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{b.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contato" className="relative z-10">
        <div className="container py-16 md:py-24">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="space-y-3 mb-10">
            <motion.p variants={fadeUp} className="text-sm font-semibold text-primary">Contato</motion.p>
            <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Precisa de ajuda?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground max-w-md text-sm">
              Atendimento por WhatsApp ou Discord. Tire dúvidas, peça suporte técnico ou solicite integração.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl"
          >
            <motion.a
              variants={fadeUp}
              href="https://discord.gg/s63aMVSbdQ"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Discord
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Suporte e updates ao vivo</p>
              </div>
            </motion.a>

            <motion.a
              variants={fadeUp}
              href="https://wa.me/553376014160"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.102 1.516 5.833L0 24l6.335-1.468A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82a9.8 9.8 0 0 1-5.26-1.529l-.378-.224-3.912.907.983-3.583-.263-.417A9.78 9.78 0 0 1 2.18 12c0-5.414 4.406-9.82 9.82-9.82 5.414 0 9.82 4.406 9.82 9.82 0 5.414-4.406 9.82-9.82 9.82z"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  WhatsApp
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Respostas rápidas para integrações</p>
              </div>
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoDreampay} alt="DreamPay" className="h-5 w-5 rounded" />
            <span className="text-sm font-bold">
              <span className="text-primary">Dream</span>
              <span className="text-foreground">Pay</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://discord.gg/s63aMVSbdQ" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            </a>
            <a href="https://wa.me/553376014160" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.102 1.516 5.833L0 24l6.335-1.468A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82a9.8 9.8 0 0 1-5.26-1.529l-.378-.224-3.912.907.983-3.583-.263-.417A9.78 9.78 0 0 1 2.18 12c0-5.414 4.406-9.82 9.82-9.82 5.414 0 9.82 4.406 9.82 9.82 0 5.414-4.406 9.82-9.82 9.82z"/></svg>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 DreamPay</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
