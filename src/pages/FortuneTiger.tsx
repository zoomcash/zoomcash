import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const SYMBOLS = [
  { emoji: "🐯", name: "Tiger", multiplier: 50, weight: 2 },
  { emoji: "🏮", name: "Lanterna", multiplier: 25, weight: 4 },
  { emoji: "🧧", name: "Envelope", multiplier: 15, weight: 6 },
  { emoji: "💰", name: "Ouro", multiplier: 10, weight: 8 },
  { emoji: "🎋", name: "Bambu", multiplier: 8, weight: 10 },
  { emoji: "🍊", name: "Laranja", multiplier: 5, weight: 12 },
  { emoji: "🎴", name: "Carta", multiplier: 3, weight: 14 },
  { emoji: "🪙", name: "Moeda", multiplier: 2, weight: 16 },
];

const GRID_SIZE = 3;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

const generatePlaceholderGrid = () =>
  Array.from({ length: TOTAL_CELLS }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);

type WinLine = { indices: number[]; symbol: typeof SYMBOLS[0]; count: number };

const FortuneTiger = () => {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [betAmount, setBetAmount] = useState("5.00");
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState(generatePlaceholderGrid);
  const [winLines, setWinLines] = useState<WinLine[]>([]);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const [revealedCells, setRevealedCells] = useState<boolean[]>(Array(TOTAL_CELLS).fill(true));
  const [history, setHistory] = useState<{ win: number; symbol?: string }[]>([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  const spin = useCallback(async () => {
    if (!user || !wallet || spinning) return;
    const amount = parseFloat(betAmount);
    const isFree = freeSpins > 0;

    if (!isFree) {
      if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
      if (amount > wallet.balance) { toast.error("Saldo insuficiente"); setAutoSpin(false); return; }
    }

    setSpinning(true);
    setWinAmount(null);
    setWinLines([]);
    setRevealedCells(Array(TOTAL_CELLS).fill(false));
    setSpinKey((k) => k + 1);

    try {
      if (isFree) {
        setFreeSpins((f) => f - 1);
      }

      // Server-side game resolution
      const { data, error } = await supabase.functions.invoke("resolve-game", {
        body: { game_type: "fortune-tiger", bet_amount: isFree ? amount : amount },
      });
      if (error) throw new Error("Erro ao processar jogo");
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["wallet"] });

      const serverGrid = data.grid;
      const serverWinLines: WinLine[] = data.winLines;
      const win: number = data.winAmount;

      // Reveal cells with staggered delay
      for (let i = 0; i < TOTAL_CELLS; i++) {
        await new Promise((r) => setTimeout(r, 120));
        setGrid((prev) => { const next = [...prev]; next[i] = serverGrid[i]; return next; });
        setRevealedCells((prev) => { const next = [...prev]; next[i] = true; return next; });
      }

      await new Promise((r) => setTimeout(r, 200));
      setWinLines(serverWinLines);

      if (serverWinLines.length > 0) {
        setWinAmount(win);
        setHistory((h) => [{ win, symbol: serverWinLines[0].symbol.emoji }, ...h.slice(0, 9)]);
        if (data.hasTigerBonus) {
          setFreeSpins((f) => f + 3);
          toast.success(`🐯 TIGER BONUS! +3 giros grátis!`, { duration: 4000 });
        } else {
          toast.success(`🎉 Você ganhou R$${win.toFixed(2)}!`);
        }
      } else {
        setHistory((h) => [{ win: 0 }, ...h.slice(0, 9)]);
        toast.error("Sem sorte dessa vez!");
      }
    } catch (err: any) {
      toast.error(err.message);
      setAutoSpin(false);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } finally {
      setSpinning(false);
    }
  }, [user, wallet, betAmount, spinning, freeSpins, queryClient]);

  // Auto-spin
  useEffect(() => {
    if (autoSpin && !spinning) {
      const t = setTimeout(spin, 800);
      return () => clearTimeout(t);
    }
  }, [autoSpin, spinning, spin]);

  // Free spins auto
  useEffect(() => {
    if (freeSpins > 0 && !spinning) {
      const t = setTimeout(spin, 1000);
      return () => clearTimeout(t);
    }
  }, [freeSpins, spinning, spin]);

  const winIndices = new Set(winLines.flatMap((w) => w.indices));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <div className="mb-6 rounded-xl border border-primary/30 bg-gradient-to-r from-[hsl(0,70%,15%)] via-[hsl(35,80%,12%)] to-[hsl(0,70%,15%)] p-4 text-center">
          <h1 className="font-display text-3xl text-primary text-glow md:text-4xl">🐯 FORTUNE TIGER 🐯</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alinhe os tigres e ganhe até <span className="font-bold text-primary">50x</span> sua aposta!
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Últimas:</span>
                  <div className="flex gap-1.5">
                    {history.slice(0, 6).map((h, i) => (
                      <span key={i} className={`rounded px-2 py-0.5 text-xs font-bold ${h.win > 0 ? "bg-casino-green/20 text-casino-green" : "bg-casino-red/20 text-casino-red"}`}>
                        {h.win > 0 ? `${h.symbol}+${h.win}` : "✗"}
                      </span>
                    ))}
                  </div>
                </div>
                {freeSpins > 0 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-full bg-primary/20 border border-primary/40 px-3 py-1 text-xs font-bold text-primary">
                    🎁 {freeSpins} Giros Grátis
                  </motion.div>
                )}
              </div>

              <div className="relative mx-auto max-w-sm">
                <div className="absolute -inset-3 rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent" />
                <div className="absolute -inset-1 rounded-xl border border-primary/10" />
                <div className="relative grid grid-cols-3 gap-2 rounded-xl bg-background/80 p-3 backdrop-blur-sm">
                  {grid.map((sym, idx) => {
                    const isWin = winIndices.has(idx);
                    const isRevealed = revealedCells[idx];
                    return (
                      <motion.div key={`${spinKey}-${idx}`} initial={{ rotateY: 90, scale: 0.5, opacity: 0 }} animate={isRevealed ? { rotateY: 0, scale: 1, opacity: 1 } : { rotateY: 90, scale: 0.5, opacity: 0.3 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className={`relative flex aspect-square items-center justify-center rounded-lg border-2 transition-colors duration-300 ${isWin ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(45,100%,50%,0.3)]" : "border-border bg-secondary/60"}`}>
                        <span className={`text-4xl md:text-5xl transition-transform duration-300 ${isWin ? "animate-bounce" : ""}`}>{sym.emoji}</span>
                        {isWin && <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute inset-0 rounded-lg border-2 border-primary" />}
                      </motion.div>
                    );
                  })}
                </div>
                {winLines.length > 0 && <div className="pointer-events-none absolute inset-0" />}
              </div>

              <AnimatePresence>
                {winAmount !== null && winAmount > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="mt-6 text-center">
                    <motion.p animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="font-display text-4xl text-primary text-glow">
                      🎉 R$ {winAmount.toFixed(2)}
                    </motion.p>
                    <p className="mt-1 text-sm text-muted-foreground">{winLines.length} linha{winLines.length > 1 ? "s" : ""} vencedora{winLines.length > 1 ? "s" : ""}!</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6">
                <p className="mb-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Tabela de Pagamentos</p>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {SYMBOLS.map((sym) => (
                    <div key={sym.emoji} className="rounded-lg bg-secondary/50 border border-border/50 p-2 transition-colors hover:border-primary/30">
                      <span className="text-xl">{sym.emoji}</span>
                      <p className="mt-0.5 text-xs font-bold text-primary">x{sym.multiplier}</p>
                      <p className="text-[10px] text-muted-foreground">{sym.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 font-display text-lg text-foreground">APOSTAR</h3>
              <div className="mb-3 rounded-lg bg-gradient-to-br from-secondary to-secondary/60 border border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">Seu saldo</p>
                <p className="font-display text-2xl text-primary text-glow">R$ {wallet?.balance?.toFixed(2) ?? "0.00"}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Valor da aposta (R$)</label>
                  <Input type="number" min="1" step="0.01" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={spinning || autoSpin} className="border-border bg-secondary text-foreground" />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {["1", "5", "10", "50"].map((v) => (
                    <button key={v} onClick={() => setBetAmount(v)} disabled={spinning || autoSpin} className="rounded bg-secondary px-2 py-1.5 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50">R${v}</button>
                  ))}
                </div>
                <Button onClick={spin} disabled={spinning || autoSpin} className="w-full bg-primary text-primary-foreground font-display text-lg tracking-wide hover:bg-primary/90 box-glow" size="lg">
                  {spinning ? "🐯 GIRANDO..." : freeSpins > 0 ? `🎁 GIRO GRÁTIS (${freeSpins})` : "🐯 GIRAR"}
                </Button>
                <Button onClick={() => setAutoSpin(!autoSpin)} disabled={spinning} variant={autoSpin ? "destructive" : "outline"} className="w-full font-display tracking-wide" size="sm">
                  {autoSpin ? "⏹ PARAR AUTO" : "▶ AUTO SPIN"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="mb-2 font-display text-sm text-foreground">COMO JOGAR</h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>🎯 Alinhe 3 símbolos iguais em linhas, colunas ou diagonais</li>
                <li>🐯 3 Tigres = <span className="text-primary font-bold">50x</span> + 3 giros grátis!</li>
                <li>🏮 3 Lanternas = <span className="text-primary font-bold">25x</span></li>
                <li>💰 8 linhas de pagamento ativas</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FortuneTiger;
