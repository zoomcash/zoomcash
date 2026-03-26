import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TrendingUp, Zap } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";

const CrashGame = () => {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [betAmount, setBetAmount] = useState("10.00");
  const [multiplier, setMultiplier] = useState(1.0);
  const [gameState, setGameState] = useState<"waiting" | "running" | "crashed">("waiting");
  const [hasBet, setHasBet] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [crashPoint, setCrashPoint] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const localCrashPointRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const betIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  // Local crash point for animation only (not for payout)
  const generateLocalCrashPoint = () => {
    const r = Math.random();
    if (r < 0.03) return 1.0;
    return Math.max(1.0, parseFloat((1 / (1 - r) * 0.97).toFixed(2)));
  };

  const drawGraph = useCallback((currentMultiplier: number, crashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "hsl(220, 15%, 18%)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const y = (h / 5) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const color = crashed ? "hsl(0, 80%, 55%)" : "hsl(145, 70%, 45%)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const maxM = Math.max(currentMultiplier, 2);
    const points = 100;
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const m = 1 + (currentMultiplier - 1) * Math.pow(t, 0.8);
      const x = (i / points) * w;
      const y = h - ((m - 1) / (maxM - 1)) * (h * 0.8) - h * 0.1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, []);

  const startGame = () => {
    const cp = generateLocalCrashPoint();
    localCrashPointRef.current = cp;
    setCrashPoint(0);
    setMultiplier(1.0);
    setGameState("running");
    setHasCashedOut(false);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentM = parseFloat((Math.pow(Math.E, elapsed * 0.15)).toFixed(2));

      if (currentM >= localCrashPointRef.current) {
        setMultiplier(localCrashPointRef.current);
        setCrashPoint(localCrashPointRef.current);
        setGameState("crashed");
        setHistory((prev) => [localCrashPointRef.current, ...prev.slice(0, 19)]);
        drawGraph(localCrashPointRef.current, true);

        if (hasBet && !hasCashedOut) {
          toast.error(`Crash em ${localCrashPointRef.current}x! Você perdeu R$${betAmount}`);
        }

        setTimeout(() => {
          setGameState("waiting");
          setHasBet(false);
          setHasCashedOut(false);
          setMultiplier(1.0);
          betIdRef.current = null;
        }, 3000);
        return;
      }

      setMultiplier(currentM);
      drawGraph(currentM, false);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  useEffect(() => {
    if (gameState === "waiting") {
      const timer = setTimeout(() => startGame(), 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const placeBet = async () => {
    if (!user || !wallet) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    if (amount > wallet.balance) { toast.error("Saldo insuficiente"); return; }

    try {
      // Server-side bet placement
      const { data, error } = await supabase.functions.invoke("resolve-game", {
        body: { game_type: "crash", bet_amount: amount },
      });
      if (error) throw new Error("Erro ao processar aposta");
      if (data?.error) throw new Error(data.error);

      betIdRef.current = data.bet_id;
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setHasBet(true);
      toast.success(`Aposta de R$${amount} realizada!`);
    } catch (err: any) {
      toast.error(err.message);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    }
  };

  const cashOut = async () => {
    if (!user || !hasBet || hasCashedOut || !betIdRef.current) return;

    try {
      // Server-side cashout validation
      const { data, error } = await supabase.functions.invoke("resolve-game", {
        body: { game_type: "crash-cashout", bet_id: betIdRef.current, cashout_multiplier: multiplier },
      });
      if (error) throw new Error("Erro ao processar cashout");
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["wallet"] });

      if (data.success) {
        setHasCashedOut(true);
        toast.success(`Cashout em ${multiplier}x! Ganhou R$${data.payout.toFixed(2)}`);
      } else {
        toast.error(`Crash em ${data.crashPoint}x! Cashout negado.`);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl text-foreground">
                  <TrendingUp className="mr-2 inline h-5 w-5 text-primary" />CRASH
                </h2>
                <div className="flex gap-2">
                  {history.slice(0, 8).map((h, i) => (
                    <span key={i} className={`rounded px-2 py-0.5 text-xs font-bold ${h >= 2 ? "bg-casino-green/20 text-casino-green" : "bg-casino-red/20 text-casino-red"}`}>{h}x</span>
                  ))}
                </div>
              </div>
              <div className="relative flex aspect-video items-center justify-center rounded-lg border border-border bg-background">
                <canvas ref={canvasRef} width={800} height={400} className="absolute inset-0 h-full w-full" />
                <div className="relative z-10 text-center">
                  <div className={`font-display text-6xl md:text-8xl ${gameState === "crashed" ? "text-casino-red" : gameState === "running" ? "text-casino-green text-glow" : "text-muted-foreground"}`}>
                    {gameState === "crashed" ? `${crashPoint}x` : gameState === "running" ? `${multiplier}x` : "..."}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {gameState === "waiting" ? "Próxima rodada em breve..." : gameState === "crashed" ? "CRASHED!" : "Faça cashout antes do crash!"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 font-display text-lg text-foreground">APOSTAR</h3>
            <div className="mb-3 rounded-lg bg-secondary p-3 text-center">
              <p className="text-xs text-muted-foreground">Seu saldo</p>
              <p className="font-display text-2xl text-primary">R$ {wallet?.balance?.toFixed(2) ?? "0.00"}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Valor da aposta (R$)</label>
                <Input type="number" min="1" step="0.01" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={hasBet} className="border-border bg-secondary text-foreground" />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {["5", "10", "50", "100"].map((v) => (
                  <button key={v} onClick={() => setBetAmount(v)} disabled={hasBet} className="rounded bg-secondary px-2 py-1.5 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50">R${v}</button>
                ))}
              </div>
              {gameState === "running" && hasBet && !hasCashedOut ? (
                <Button onClick={cashOut} className="w-full bg-casino-green text-accent-foreground font-display text-lg tracking-wide hover:bg-casino-green/90 box-glow-green" size="lg">
                  <Zap className="mr-2 h-5 w-5" />CASHOUT {(parseFloat(betAmount) * multiplier).toFixed(2)}
                </Button>
              ) : (
                <Button onClick={placeBet} disabled={hasBet || gameState === "crashed"} className="w-full bg-primary text-primary-foreground font-display text-lg tracking-wide hover:bg-primary/90" size="lg">
                  {hasBet ? hasCashedOut ? "AGUARDANDO..." : "APOSTADO ✓" : "APOSTAR"}
                </Button>
              )}
            </div>
            {hasCashedOut && (
              <div className="mt-3 rounded-lg bg-casino-green/10 border border-casino-green/30 p-3 text-center">
                <p className="text-sm font-bold text-casino-green">✅ Cashout em {multiplier}x</p>
                <p className="text-xs text-muted-foreground">Ganho: R${(parseFloat(betAmount) * multiplier).toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CrashGame;
