import { Shield, Zap, Gift, Smartphone } from "lucide-react";

const features = [
  { icon: Gift, title: "Prêmios reais", desc: "Ganhe prêmios de verdade direto no seu PIX." },
  { icon: Zap, title: "Saques rápidos", desc: "Receba seus ganhos em minutos." },
  { icon: Shield, title: "100% seguro", desc: "Plataforma criptografada e protegida." },
  { icon: Smartphone, title: "Jogue pelo celular", desc: "Raspe de qualquer lugar, a qualquer hora." },
];

const PromoBanner = () => {
  return (
    <section className="border-y border-border bg-card/40 py-8 md:py-12">
      <div className="container">
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-6">
          Por que <span className="text-primary">PixRaspa</span>?
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-start rounded-lg border border-border bg-secondary/30 p-4 md:p-5 transition-colors hover:border-primary/25">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">{f.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
