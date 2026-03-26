import { useEffect, useState } from "react";

const fakeWinners = [
  { name: "Carlos V****", prize: "Mil Reais", value: "R$ 1.000,00", emoji: "💰" },
  { name: "Alexandre P****", prize: "Apple Watch", value: "R$ 1.500,00", emoji: "⌚" },
  { name: "Miguel C****", prize: "Iphone 15 Pro", value: "R$ 5.000,00", emoji: "📱" },
  { name: "Raí S****", prize: "PIX", value: "R$ 500,00", emoji: "💸" },
  { name: "Fernanda L****", prize: "JBL Speaker", value: "R$ 800,00", emoji: "🔊" },
  { name: "Ana B****", prize: "Perfume Import.", value: "R$ 350,00", emoji: "🧴" },
  { name: "João M****", prize: "Moto Honda", value: "R$ 12.000,00", emoji: "🏍️" },
  { name: "Lucas R****", prize: "Notebook", value: "R$ 3.500,00", emoji: "💻" },
];

const LiveWins = () => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 1) % fakeWinners.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const visibleWinners = [...fakeWinners, ...fakeWinners].slice(offset, offset + 6);

  return (
    <section className="bg-card/60 py-3 border-y border-border">
      <div className="container">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-medium">Últimos ganhos</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {visibleWinners.map((w, i) => (
            <div
              key={`${w.name}-${i}`}
              className="flex min-w-[130px] md:min-w-[160px] items-center gap-2 rounded-lg bg-secondary/50 p-2.5 border border-border/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-base">
                {w.emoji}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{w.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{w.prize}</p>
                <p className="text-xs font-semibold text-primary font-mono">{w.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LiveWins;
