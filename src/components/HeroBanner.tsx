import heroImg from "@/assets/hero-raspadinha.jpg";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const HeroBanner = () => {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="Raspadinha banner" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>

      <div className="container relative z-10 flex flex-col items-start justify-center py-12 sm:py-16 md:py-24 lg:py-28">
        <span className="mb-3 inline-block rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
          Prêmios de até R$ 20.000
        </span>
        <h2 className="text-3xl leading-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl font-extrabold max-w-xl">
          A galera já tá raspando
          <span className="block text-primary mt-1">e ganhando!</span>
        </h2>
        <p className="mt-4 max-w-md text-sm text-muted-foreground sm:text-base md:text-lg">
          Raspe e concorra a prêmios incríveis. PIX na hora, eletrônicos, cosméticos e muito mais.
        </p>
        <Button
          size="lg"
          className="mt-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-5 rounded-xl text-base font-bold transition-colors"
          onClick={() => document.getElementById("raspadinhas")?.scrollIntoView({ behavior: "smooth" })}
        >
          Jogar agora <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
};

export default HeroBanner;
