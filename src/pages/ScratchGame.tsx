import { useRef, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

import cardPix from "@/assets/card-pix.png";

interface PrizeDef {
  symbol: string;
  label: string;
  value: number;
}

interface CardDef {
  id: string;
  name: string;
  image: string;
  price: number;
  is_free: boolean;
  prizes: PrizeDef[];
}

// --- Win Celebration Dialog ---
const WinCelebration = ({
  open,
  totalWin,
  winLabel,
  onClose,
}: {
  open: boolean;
  totalWin: number;
  winLabel: string;
  onClose: () => void;
}) => {
  // Generate confetti particles
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 2,
    size: 6 + Math.random() * 10,
    color: ["hsl(48 100% 50%)", "hsl(38 100% 45%)", "hsl(0 75% 50%)", "hsl(120 60% 50%)", "hsl(200 80% 60%)"][
      Math.floor(Math.random() * 5)
    ],
  }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-primary/40 bg-gradient-to-b from-card via-card to-background p-0 overflow-hidden max-w-sm">
        {/* Confetti overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
              initial={{ y: -20, opacity: 1, scale: 0 }}
              animate={{
                y: ["-20px", "400px"],
                opacity: [1, 1, 0],
                scale: [0, 1, 0.5],
                rotate: [0, 360],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-10 text-center">
          {/* Glowing icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 box-glow"
          >
            <Sparkles className="h-10 w-10 text-primary" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="font-display text-3xl text-primary text-glow">
              PARABÉNS!
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Você ganhou na raspadinha!</p>
          </motion.div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 150, delay: 0.5 }}
            className="my-2 rounded-2xl border-2 border-primary/30 bg-primary/10 px-8 py-5"
          >
            <p className="text-sm text-muted-foreground">Prêmio</p>
            <p className="font-display text-4xl text-primary text-glow">
              R$ {totalWin.toFixed(2).replace(".", ",")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{winLabel}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Wallet className="h-4 w-4 text-primary" />
            Valor adicionado à sua carteira!
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="w-full"
          >
            <Button
              size="lg"
              onClick={onClose}
              className="w-full rounded-full bg-primary text-primary-foreground font-display text-lg tracking-wide hover:bg-primary/90 box-glow py-6"
            >
              Continuar 🎉
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Unified Scratch Canvas ---
const GRID_COLS = 3;
const GRID_ROWS = 3;
const CANVAS_SIZE = 320;
const CELL_SIZE = CANVAS_SIZE / GRID_COLS;
const REVEAL_THRESHOLD = 0.25;

interface UnifiedScratchCanvasProps {
  prizes: PrizeDef[];
  onAllRevealed: () => void;
  revealSignal: number;
  gameKey: number;
}

const UnifiedScratchCanvas = ({ prizes, onAllRevealed, revealSignal, gameKey }: UnifiedScratchCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [cleared, setCleared] = useState(false);
  const clearedRef = useRef(false);
  const revealedCells = useRef(new Set<number>());
  const [revealedSet, setRevealedSet] = useState(new Set<number>());
  const onAllRevealedRef = useRef(onAllRevealed);
  onAllRevealedRef.current = onAllRevealed;
  const hasCalledReveal = useRef(false);

  const triggerAllRevealed = useCallback(() => {
    if (hasCalledReveal.current) return;
    hasCalledReveal.current = true;
    clearedRef.current = true;
    setCleared(true);
    onAllRevealedRef.current();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    revealedCells.current = new Set();
    hasCalledReveal.current = false;
    clearedRef.current = false;
    setRevealedSet(new Set());
    setCleared(false);

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#c0c0c0");
    gradient.addColorStop(0.3, "#d8d8d8");
    gradient.addColorStop(0.5, "#b0b0b0");
    gradient.addColorStop(0.7, "#d0d0d0");
    gradient.addColorStop(1, "#a8a8a8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#a0a0a0";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();
    }
    for (let i = 1; i < GRID_ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    ctx.fillStyle = "#b0b0b0";
    ctx.font = "bold 11px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        ctx.fillText("RASPE", c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2);
      }
    }

    for (let i = 0; i < 150; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150, 150, 150, ${Math.random() * 0.4})`;
      ctx.fill();
    }
  }, [gameKey]);

  const lastRevealSignal = useRef(revealSignal);
  useEffect(() => {
    if (revealSignal !== lastRevealSignal.current && !clearedRef.current) {
      lastRevealSignal.current = revealSignal;
      const all = new Set(Array.from({ length: 9 }, (_, i) => i));
      setRevealedSet(all);
      triggerAllRevealed();
    }
  }, [revealSignal, triggerAllRevealed]);

  const checkCellRevealed = useCallback(
    (ctx: CanvasRenderingContext2D, cellIndex: number) => {
      if (revealedCells.current.has(cellIndex) || clearedRef.current) return;
      const col = cellIndex % GRID_COLS;
      const row = Math.floor(cellIndex / GRID_COLS);
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;
      const imageData = ctx.getImageData(x, y, CELL_SIZE, CELL_SIZE);
      let transparent = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] === 0) transparent++;
      }
      const pct = transparent / (CELL_SIZE * CELL_SIZE);
      if (pct >= REVEAL_THRESHOLD) {
        revealedCells.current.add(cellIndex);
        setRevealedSet(new Set(revealedCells.current));
        if (revealedCells.current.size >= 9) {
          triggerAllRevealed();
        }
      }
    },
    [triggerAllRevealed]
  );

  const scratch = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas || clearedRef.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();

      const col = Math.floor(x / CELL_SIZE);
      const row = Math.floor(y / CELL_SIZE);
      const cellIndex = row * GRID_COLS + col;
      if (cellIndex >= 0 && cellIndex < 9) {
        checkCellRevealed(ctx, cellIndex);
      }
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
          checkCellRevealed(ctx, nr * GRID_COLS + nc);
        }
      }
    },
    [checkCellRevealed]
  );

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getPos(e);
    scratch(x, y);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const { x, y } = getPos(e);
    scratch(x, y);
  };

  const handleEnd = () => {
    isDrawing.current = false;
  };

  return (
    <div className="relative mx-auto w-full max-w-[320px] aspect-square">
      {/* Prize grid underneath */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0 rounded-xl overflow-hidden border-2 border-primary/30">
        {prizes.map((prize, i) => {
          const isRevealed = revealedSet.has(i);
          const isWinner = prizes.filter(p => p.symbol === prize.symbol).length >= 3 && prize.value > 0;
          return (
            <div
              key={i}
              className={`flex flex-col items-center justify-center gap-0.5 border border-border/50 transition-colors duration-300 ${
                isRevealed && isWinner
                  ? "bg-primary/15"
                  : "bg-gradient-to-br from-yellow-900/30 via-background to-yellow-900/20"
              }`}
            >
              <span className="text-2xl sm:text-3xl">{prize.symbol}</span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-foreground text-center leading-tight px-1">
                {prize.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Single scratch canvas on top */}
      {!cleared && (
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="absolute inset-0 h-full w-full cursor-pointer rounded-xl touch-none z-10"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      )}
    </div>
  );
};

// --- Main Page ---
const ScratchGame = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const { user } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cardDef, setCardDef] = useState<CardDef | null>(null);
  const [loadingCard, setLoadingCard] = useState(true);

  useEffect(() => {
    const loadCard = async () => {
      const { data: card } = await (supabase.from as any)("scratch_cards")
        .select("*")
        .eq("id", cardId)
        .single();
      const { data: prizes } = await (supabase.from as any)("scratch_card_prizes")
        .select("id, card_id, symbol, label, value, sort_order")
        .eq("card_id", cardId)
        .order("sort_order", { ascending: true });

      if (card && prizes) {
        setCardDef({
          id: card.id,
          name: card.name,
          image: card.image_url || cardPix,
          price: Number(card.price),
          is_free: card.is_free,
          prizes: prizes.map((p: any) => ({
            symbol: p.symbol,
            label: p.label,
            value: Number(p.value),
          })),
        });
      }
      setLoadingCard(false);
    };
    loadCard();
  }, [cardId]);

  const isFree = cardDef?.is_free || false;

  const [gameState, setGameState] = useState<"idle" | "playing" | "revealed">("idle");
  const [currentPrizes, setCurrentPrizes] = useState<PrizeDef[]>([]);
  const [totalWin, setTotalWin] = useState(0);
  const [winLabel, setWinLabel] = useState("");
  const [history, setHistory] = useState<{ win: number; label: string }[]>([]);
  const [freeAvailable, setFreeAvailable] = useState(false);
  const [checkingFree, setCheckingFree] = useState(true);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(1);
  const [sessionWins, setSessionWins] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [revealSignal, setRevealSignal] = useState(0);
  const [loadingRound, setLoadingRound] = useState(false);

  const currentRoundRef = useRef(0);
  const totalRoundsRef = useRef(1);
  currentRoundRef.current = currentRound;
  totalRoundsRef.current = totalRounds;

  const GRID_SIZE_COUNT = 9;

  useEffect(() => {
    if (!isFree || !user) { setCheckingFree(false); return; }
    const checkFree = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("description", "Raspadinha Grátis Diária")
        .gte("created_at", today + "T00:00:00.000Z")
        .limit(1);
      setFreeAvailable(!data || data.length === 0);
      setCheckingFree(false);
    };
    checkFree();
  }, [isFree, user]);

  // Server-side round resolution
  const resolveRoundFromServer = useCallback(async () => {
    if (!cardDef) return null;
    setLoadingRound(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-game", {
        body: { game_type: "scratch", card_id: cardDef.id },
      });
      if (error) throw new Error("Erro ao processar jogo");
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      return data;
    } catch (err: any) {
      toast.error(err.message);
      return null;
    } finally {
      setLoadingRound(false);
    }
  }, [cardDef, queryClient]);

  const startGame = useCallback(async (qty: number = 1) => {
    if (!user) { toast.error("Faça login para jogar!"); navigate("/auth"); return; }
    if (!cardDef) return;

    if (isFree && !freeAvailable) { toast.error("Você já usou sua raspadinha grátis hoje! Volte amanhã 🎫"); return; }
    if (!isFree && (!wallet || wallet.balance < cardDef.price)) { toast.error("Saldo insuficiente!"); return; }

    setTotalRounds(qty);
    setCurrentRound(1);
    setSessionWins(0);

    // Get first round from server
    const result = await resolveRoundFromServer();
    if (!result) return;

    if (isFree) setFreeAvailable(false);

    setCurrentPrizes(result.prizes);
    setTotalWin(result.winAmount);
    setWinLabel(result.winLabel || "");
    setGameKey((k) => k + 1);
    setGameState("playing");
  }, [user, wallet, cardDef, navigate, isFree, freeAvailable, resolveRoundFromServer]);

  const advanceRound = useCallback(async () => {
    if (!cardDef) return;
    const nextRound = currentRoundRef.current + 1;
    if (nextRound > totalRoundsRef.current) { setGameState("idle"); return; }

    setCurrentRound(nextRound);

    const result = await resolveRoundFromServer();
    if (!result) { setGameState("idle"); return; }

    setCurrentPrizes(result.prizes);
    setTotalWin(result.winAmount);
    setWinLabel(result.winLabel || "");
    setGameKey((k) => k + 1);
    setGameState("playing");
  }, [cardDef, resolveRoundFromServer]);

  // Called when all cells are revealed - just show pre-determined result
  const resolveRound = useCallback(async () => {
    if (totalWin > 0) {
      setSessionWins((s) => s + totalWin);
      setShowWinDialog(true);
    } else {
      toast.info("Não foi dessa vez... 🍀", { duration: 2000 });
    }

    setHistory((prev) => [{ win: totalWin, label: winLabel || "Nada" }, ...prev].slice(0, 10));

    if (currentRoundRef.current < totalRoundsRef.current) {
      setTimeout(() => {
        if (totalWin > 0) return; // Wait for dialog close
        advanceRound();
      }, 2000);
    } else {
      if (totalWin === 0) {
        setTimeout(() => setGameState("idle"), 2500);
      }
    }
  }, [totalWin, winLabel, advanceRound]);

  const handleAllRevealed = useCallback(() => {
    setGameState("revealed");
    resolveRound();
  }, [resolveRound]);

  const handleWinDialogClose = useCallback(() => {
    setShowWinDialog(false);
    if (currentRoundRef.current < totalRoundsRef.current) {
      advanceRound();
      setGameState("playing");
    } else {
      setGameState("idle");
    }
  }, [advanceRound]);

  const handleRevealAll = useCallback(() => {
    setRevealSignal((s) => s + 1);
  }, []);

  if (loadingCard || !cardDef) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />

      <WinCelebration
        open={showWinDialog}
        totalWin={totalWin}
        winLabel={winLabel}
        onClose={handleWinDialogClose}
      />

      <div className="container max-w-lg py-4">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {/* Card header */}
        <div className="mb-4 overflow-hidden rounded-xl border border-border">
          <div className="relative h-32 overflow-hidden">
            <img src={cardDef.image} alt={cardDef.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            <div className="absolute bottom-3 left-4">
              <h1 className="font-display text-xl text-foreground">{cardDef.name}</h1>
              <p className="text-xs text-primary font-semibold">
                {isFree ? "GRÁTIS — 1x por dia" : `R$ ${cardDef.price.toFixed(2).replace(".", ",")} por raspadinha`}
              </p>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-card border border-border p-3">
          <span className="text-sm text-muted-foreground">Seu saldo:</span>
          <span className="font-display text-lg text-primary">
            R$ {wallet?.balance?.toFixed(2) ?? "0.00"}
          </span>
        </div>

        {/* Game area */}
        {gameState === "idle" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Pronto para raspar?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Encontre 3 símbolos iguais e ganhe o prêmio!
              </p>
            </div>

            {/* Prize table */}
            <div className="w-full rounded-lg bg-card border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Tabela de prêmios</p>
              <div className="space-y-1.5">
                {cardDef.prizes
                  .filter((p) => p.value > 0)
                  .map((p) => (
                    <div key={p.symbol} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-lg">{p.symbol}</span>
                        <span className="text-foreground">{p.label}</span>
                      </span>
                      <span className="font-semibold text-primary">
                        R$ {p.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Quantity selector - only for paid cards */}
            {!isFree && (
              <div className="w-full rounded-lg bg-card border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Quantidade</p>
                <div className="flex gap-2">
                  {[1, 5, 10].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setQuantity(qty)}
                      className={`flex-1 rounded-lg border-2 py-3 text-center transition-all ${
                        quantity === qty
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <span className="font-display text-lg block">{qty}x</span>
                      <span className="text-[10px] text-muted-foreground">
                        R$ {(cardDef.price * qty).toFixed(2).replace(".", ",")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              size="lg"
              onClick={() => startGame(isFree ? 1 : quantity)}
              disabled={loadingRound || (isFree && !freeAvailable) || checkingFree}
              className="w-full rounded-full bg-primary text-primary-foreground font-display text-lg tracking-wide hover:bg-primary/90 box-glow py-6"
            >
              {checkingFree
                ? "Verificando..."
                : loadingRound
                ? "Processando..."
                : isFree
                ? freeAvailable
                  ? "🎁 Raspar Grátis!"
                  : "Já raspou hoje — volte amanhã!"
                : quantity === 1
                ? `Comprar Raspadinha — R$ ${cardDef.price.toFixed(2).replace(".", ",")}`
                : `Comprar ${quantity}x — R$ ${(cardDef.price * quantity).toFixed(2).replace(".", ",")}`}
            </Button>

            {sessionWins > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-lg border border-primary/30 bg-primary/10 p-3 text-center"
              >
                <p className="text-sm text-muted-foreground">Total ganho nesta sessão</p>
                <p className="font-display text-xl text-primary text-glow">
                  R$ {sessionWins.toFixed(2).replace(".", ",")}
                </p>
              </motion.div>
            )}
          </div>
        )}

        {(gameState === "playing" || gameState === "revealed") && (
          <div className="flex flex-col items-center gap-4">
            {/* Round indicator for multi-buy */}
            {totalRounds > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-display text-primary">{currentRound}</span> / {totalRounds} raspadinhas
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {gameState === "playing"
                ? "Passe o dedo ou mouse para raspar! 🎯"
                : totalWin > 0
                ? "🎉 Você ganhou!"
                : "🍀 Tente novamente!"}
            </p>

            {/* Unified scratch canvas */}
            <UnifiedScratchCanvas
              key={gameKey}
              prizes={currentPrizes}
              onAllRevealed={handleAllRevealed}
              revealSignal={revealSignal}
              gameKey={gameKey}
            />

            {gameState === "playing" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevealAll}
                disabled={gameState !== "playing"}
                className="rounded-full text-xs"
              >
                Raspar Tudo
              </Button>
            )}

            {gameState === "revealed" && (
              <Button
                size="lg"
                onClick={() => {
                  setShowWinDialog(false);
                  if (currentRoundRef.current < totalRoundsRef.current) {
                    advanceRound();
                    setGameState("playing");
                  } else {
                    setGameState("idle");
                  }
                }}
                className="w-full rounded-full bg-primary text-primary-foreground font-display text-lg tracking-wide hover:bg-primary/90 box-glow py-6 gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                {currentRoundRef.current < totalRoundsRef.current ? "Próxima Raspadinha" : "Jogar Novamente"}
              </Button>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6 rounded-lg bg-card border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Últimas jogadas</p>
            <div className="space-y-1.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{h.label}</span>
                  <span className={`font-semibold ${h.win > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {h.win > 0 ? `+R$ ${h.win.toFixed(2)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ScratchGame;
