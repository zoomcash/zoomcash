import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import cardPix from "@/assets/card-pix.png";
import cardEletronicos from "@/assets/card-eletronicos.png";
import cardVeiculos from "@/assets/card-veiculos.png";
import cardCosmeticos from "@/assets/card-cosmeticos.png";

const localImages: Record<string, string> = {
  "sonho-de-consumo": cardEletronicos,
  "super-premios": cardVeiculos,
  "me-mimei": cardCosmeticos,
};

interface ScratchCard {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  is_free: boolean;
  category: string;
  badge: string | null;
  vip: boolean;
  max_prize_label: string;
  description: string;
}

const ScratchCardGrid = () => {
  const [activeCategory, setActiveCategory] = useState("Destaque");
  const [cards, setCards] = useState<ScratchCard[]>([]);
  const [categories, setCategories] = useState<string[]>(["Destaque"]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase.from as any)("scratch_cards")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (data) {
        setCards(data);
        const cats = ["Destaque", ...new Set(data.map((c: ScratchCard) => c.category).filter((c: string) => c !== "Destaque"))] as string[];
        setCategories(cats);
      }
    };
    fetch();
  }, []);

  const filtered = activeCategory === "Destaque"
    ? cards
    : cards.filter((c) => c.category === activeCategory);

  return (
    <section id="raspadinhas" className="py-8 md:py-12">
      <div className="container">
        {/* Section title */}
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">
            Escolha sua raspadinha
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Selecione uma categoria e comece a raspar</p>
        </div>

        {/* Category tabs */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 md:justify-start">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => (
            <div key={card.id} className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30">
              {/* Image */}
              <div className="relative aspect-[2/1] sm:aspect-[16/9] overflow-hidden">
                <img
                  src={localImages[card.id] || card.image_url || cardPix}
                  alt={card.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Price badge */}
                <div className="absolute right-3 top-3 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                  {card.is_free ? "Grátis" : `R$ ${card.price.toFixed(2).replace(".", ",")}`}
                </div>

                {card.vip && (
                  <div className="absolute right-3 bottom-3">
                    <span className="rounded-md bg-gradient-to-r from-amber-600 to-orange-500 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
                      VIP
                    </span>
                  </div>
                )}

                {card.badge && (
                  <div className="absolute left-3 top-3 rounded-md bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                    {card.badge}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="text-base font-bold text-foreground">{card.name}</h3>
                <p className="text-sm font-medium text-primary">{card.max_prize_label}</p>
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{card.description}</p>
                <Link
                  to={`/scratch/${card.id}`}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {card.is_free ? "Raspar grátis 🎁" : "Jogar"} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScratchCardGrid;
