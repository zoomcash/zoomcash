import gameSlots from "@/assets/game-slots.jpg";
import gameRoulette from "@/assets/game-roulette.jpg";
import gameBlackjack from "@/assets/game-blackjack.jpg";
import gamePoker from "@/assets/game-poker.jpg";
import gameCrash from "@/assets/game-crash.jpg";
import gameBaccarat from "@/assets/game-baccarat.jpg";
import gameTiger from "@/assets/game-tiger.jpg";
import gameSports from "@/assets/game-sports.jpg";
import { Star, TrendingUp, Flame, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Game {
  name: string;
  image: string;
  category: string;
  badge?: string;
  provider: string;
  href?: string;
}

const games: Game[] = [
  { name: "Fortune Tiger", image: gameTiger, category: "Slots", badge: "🔥 Popular", provider: "BetZone", href: "/fortune-tiger" },
  { name: "Mega Slots 777", image: gameSlots, category: "Slots", badge: "⭐ Novo", provider: "Pragmatic", href: "/slots" },
  { name: "Crash Rocket", image: gameCrash, category: "Crash", badge: "🚀 Trending", provider: "Spribe", href: "/crash" },
  { name: "Roleta Europeia", image: gameRoulette, category: "Ao Vivo", provider: "Evolution" },
  { name: "Blackjack VIP", image: gameBlackjack, category: "Ao Vivo", provider: "Evolution" },
  { name: "Poker Texas", image: gamePoker, category: "Cartas", provider: "Microgaming" },
  { name: "Baccarat Gold", image: gameBaccarat, category: "Ao Vivo", provider: "Pragmatic" },
  { name: "Apostas Esportivas", image: gameSports, category: "Esportes", badge: "⚽ Live", provider: "BetZone" },
];

const categories = [
  { label: "Todos", icon: Star },
  { label: "Slots", icon: Flame },
  { label: "Ao Vivo", icon: TrendingUp },
  { label: "Esportes", icon: Trophy },
];

const GameGrid = () => {
  return (
    <section id="cassino" className="py-12">
      <div className="container">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-display text-2xl text-foreground md:text-3xl">
            🎮 Jogos <span className="text-primary">Populares</span>
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat, i) => (
              <button
                key={cat.label}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  i === 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-4">
          {games.map((game) => (
            <div
              key={game.name}
              className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card game-card-hover"
            >
              <div className="aspect-square overflow-hidden">
                <img
                  src={game.image}
                  alt={game.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              {game.badge && (
                <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                  {game.badge}
                </span>
              )}

              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                {game.href ? (
                  <Link to={game.href} className="rounded-lg bg-primary px-6 py-2.5 font-display text-sm tracking-wider text-primary-foreground shadow-lg transition-transform hover:scale-105">
                    JOGAR
                  </Link>
                ) : (
                  <button onClick={() => toast.info("Jogo em breve!")} className="rounded-lg bg-primary px-6 py-2.5 font-display text-sm tracking-wider text-primary-foreground shadow-lg transition-transform hover:scale-105">
                    EM BREVE
                  </button>
                )}
              </div>

              <div className="p-3">
                <p className="truncate text-sm font-semibold text-foreground">{game.name}</p>
                <p className="text-xs text-muted-foreground">{game.provider}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GameGrid;
