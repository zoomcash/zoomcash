import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣", "🍀", "🎰"];

const PAYOUTS: Record<string, number> = {
  "7️⃣": 50, "💎": 25, "🎰": 15, "⭐": 10,
  "🔔": 8, "🍀": 5, "🍋": 3, "🍒": 2,
};

const REEL_COUNT = 3;
const VISIBLE_SYMBOLS = 3;
const SPIN_DURATION = [1800, 2200, 2600];

const randomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
const generateReel = (length: number) => Array.from({ length }, randomSymbol);

const SlotsGame = () => {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [betAmount, setBetAmount] = useState("5.00");
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[][]>(
    Array.from({ length: REEL_COUNT }, () => generateReel(VISIBLE_SYMBOLS))
  );
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [history, setHistory] = useState<{ symbols: string[]; win: number }[]>([]);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  const spin = async () => {
    if (!user || !wallet || spinning) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    if (amount > wallet.balance) { toast.error("Saldo insuficiente"); return; }

    setSpinning(true);
    setWinAmount(null);

    try {
      // Server-side game resolution
      const { data, error } = await supabase.functions.invoke("resolve-game", {
        body: { game_type: "slots", bet_amount: amount },
      });
      if (error) throw new Error("Erro ao processar jogo");
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["wallet"] });

      const finalReels: string[][] = data.reels;
      const win: number = data.winAmount;

      // Animate reels
      for (let i = 0; i < REEL_COUNT; i++) {
        reelRefs.current[i]?.classList.add("reel-spinning");
      }
      for (let i = 0; i < REEL_COUNT; i++) {
        await new Promise((r) => setTimeout(r, SPIN_DURATION[i]));
        reelRefs.current[i]?.classList.remove("reel-spinning");
        setReels((prev) => { const next = [...prev]; next[i] = finalReels[i]; return next; });
      }

      if (win > 0) {
        setWinAmount(win);
        toast.success(`🎉 Você ganhou R$${win.toFixed(2)}!`);
      } else {
        toast.error("Sem sorte dessa vez!");
      }

      setHistory((prev) => [{ symbols: data.middleRow, win }, ...prev.slice(0, 9)]);
    } catch (err: any) {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Slot machine */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl text-foreground">🎰 MEGA SLOTS</h2>
                <div className="flex gap-1.5 overflow-x-auto">
                  {history.slice(0, 5).map((h, i) => (
                    <span key={i} className={`rounded px-2 py-0.5 text-xs font-bold ${h.win > 0 ? "bg-casino-green/20 text-casino-green" : "bg-casino-red/20 text-casino-red"}`}>
                      {h.win > 0 ? `+R$${h.win}` : "✗"}
                    </span>
                  ))}
                </div>
              </div>

              {/* Reels container */}
              <div className="relative mx-auto flex max-w-md items-center justify-center gap-3 rounded-xl border-2 border-primary/30 bg-background p-6 md:p-10">
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-primary/40 z-10" />
                {reels.map((reel, reelIdx) => (
                  <div key={reelIdx} className="relative overflow-hidden rounded-lg border border-border bg-secondary" style={{ width: "5.5rem", height: "10rem" }}>
                    <div ref={(el) => { reelRefs.current[reelIdx] = el; }} className="flex flex-col items-center justify-center transition-transform" style={{ height: "100%" }}>
                      {reel.map((symbol, symIdx) => (
                        <div key={symIdx} className={`flex items-center justify-center text-4xl md:text-5xl ${symIdx === 1 ? "scale-110" : "opacity-40 scale-90"}`} style={{ height: `${100 / VISIBLE_SYMBOLS}%`, transition: "transform 0.3s ease-out" }}>
                          {symbol}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {winAmount !== null && winAmount > 0 && (
                <div className="mt-4 text-center animate-scale-in">
                  <p className="font-display text-3xl text-primary text-glow">🎉 R$ {winAmount.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Parabéns!</p>
                </div>
              )}

              <div className="mt-6 grid grid-cols-4 gap-2 text-center text-xs">
                {Object.entries(PAYOUTS).map(([sym, mult]) => (
                  <div key={sym} className="rounded bg-secondary p-2">
                    <span className="text-lg">{sym}</span>
                    <p className="mt-0.5 text-muted-foreground">x{mult}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bet panel */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 font-display text-lg text-foreground">APOSTAR</h3>
            <div className="mb-3 rounded-lg bg-secondary p-3 text-center">
              <p className="text-xs text-muted-foreground">Seu saldo</p>
              <p className="font-display text-2xl text-primary">R$ {wallet?.balance?.toFixed(2) ?? "0.00"}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Valor da aposta (R$)</label>
                <Input type="number" min="1" step="0.01" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={spinning} className="border-border bg-secondary text-foreground" />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {["1", "5", "10", "50"].map((v) => (
                  <button key={v} onClick={() => setBetAmount(v)} disabled={spinning} className="rounded bg-secondary px-2 py-1.5 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50">R${v}</button>
                ))}
              </div>
              <Button onClick={spin} disabled={spinning} className="w-full bg-primary text-primary-foreground font-display text-lg tracking-wide hover:bg-primary/90" size="lg">
                {spinning ? (<span className="flex items-center gap-2"><Zap className="h-5 w-5 animate-spin" />GIRANDO...</span>) : "🎰 GIRAR"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SlotsGame;
