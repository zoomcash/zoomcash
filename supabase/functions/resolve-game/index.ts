import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Cryptographically secure random ---
function secureRandom(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xffffffff + 1);
}

// --- Slots logic ---
const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣", "🍀", "🎰"];
const SLOT_PAYOUTS: Record<string, number> = {
  "7️⃣": 50, "💎": 25, "🎰": 15, "⭐": 10,
  "🔔": 8, "🍀": 5, "🍋": 3, "🍒": 2,
};

function resolveSlots(betAmount: number) {
  const reels = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(secureRandom() * SLOT_SYMBOLS.length)])
  );
  const middleRow = reels.map((r) => r[1]);
  let winAmount = 0;
  if (middleRow[0] === middleRow[1] && middleRow[1] === middleRow[2]) {
    winAmount = betAmount * (SLOT_PAYOUTS[middleRow[0]] || 2);
  } else if (middleRow[0] === middleRow[1] || middleRow[1] === middleRow[2]) {
    const m = middleRow[0] === middleRow[1] ? middleRow[0] : middleRow[2];
    winAmount = betAmount * Math.max(1, Math.floor((SLOT_PAYOUTS[m] || 2) / 3));
  } else if (middleRow.includes("🍒")) {
    winAmount = betAmount * 0.5;
  }
  return { reels, middleRow, winAmount: parseFloat(winAmount.toFixed(2)) };
}

// --- Fortune Tiger logic ---
const TIGER_SYMBOLS = [
  { emoji: "🐯", name: "Tiger", multiplier: 50, weight: 2 },
  { emoji: "🏮", name: "Lanterna", multiplier: 25, weight: 4 },
  { emoji: "🧧", name: "Envelope", multiplier: 15, weight: 6 },
  { emoji: "💰", name: "Ouro", multiplier: 10, weight: 8 },
  { emoji: "🎋", name: "Bambu", multiplier: 8, weight: 10 },
  { emoji: "🍊", name: "Laranja", multiplier: 5, weight: 12 },
  { emoji: "🎴", name: "Carta", multiplier: 3, weight: 14 },
  { emoji: "🪙", name: "Moeda", multiplier: 2, weight: 16 },
];
const TIGER_WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function weightedRandomTiger() {
  const total = TIGER_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
  let r = secureRandom() * total;
  for (const sym of TIGER_SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return TIGER_SYMBOLS[TIGER_SYMBOLS.length - 1];
}

function resolveFortuneTiger(betAmount: number) {
  const grid = Array.from({ length: 9 }, weightedRandomTiger);
  const winLines: { indices: number[]; symbol: typeof TIGER_SYMBOLS[0]; count: number }[] = [];
  for (const line of TIGER_WIN_LINES) {
    const syms = line.map((i) => grid[i]);
    if (syms[0].emoji === syms[1].emoji && syms[1].emoji === syms[2].emoji) {
      winLines.push({ indices: line, symbol: syms[0], count: 3 });
    }
  }
  let winAmount = 0;
  if (winLines.length > 0) {
    winAmount = parseFloat((betAmount * winLines.reduce((s, w) => s + w.symbol.multiplier, 0)).toFixed(2));
  }
  const hasTigerBonus = winLines.some((w) => w.symbol.emoji === "🐯");
  return { grid, winLines, winAmount, hasTigerBonus };
}

// --- Scratch logic ---
async function resolveScratch(supabase: any, userId: string, cardId: string) {
  const { data: card, error: cardErr } = await supabase
    .from("scratch_cards").select("*").eq("id", cardId).single();
  if (cardErr || !card) throw new Error("Card not found");

  const { data: prizeDefs, error: prizeErr } = await supabase
    .from("scratch_card_prizes").select("*").eq("card_id", cardId).order("sort_order", { ascending: true });
  if (prizeErr || !prizeDefs?.length) throw new Error("Prizes not found");

  const prizes = prizeDefs.map((p: any) => ({
    symbol: p.symbol, label: p.label, value: Number(p.value), weight: Number(p.weight),
  }));

  // Handle free vs paid
  if (!card.is_free) {
    const { error: betErr } = await supabase.rpc("update_wallet_balance", {
      _user_id: userId, _amount: Number(card.price), _type: "bet",
      _description: `Raspadinha: ${card.name}`,
    });
    if (betErr) {
      throw new Error(betErr.message?.includes("Insufficient") ? "Saldo insuficiente" : betErr.message);
    }
  } else {
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase.from("transactions").select("id")
      .eq("user_id", userId).eq("description", "Raspadinha Grátis Diária")
      .gte("created_at", today + "T00:00:00.000Z").limit(1);
    if (existing?.length) throw new Error("Já usou sua raspadinha grátis hoje!");
    await supabase.from("transactions").insert({
      user_id: userId, type: "bet", amount: 0, description: "Raspadinha Grátis Diária",
    });
  }

  // Pick 9 prizes
  const picked = Array.from({ length: 9 }, () => {
    const total = prizes.reduce((s: number, p: any) => s + p.weight, 0);
    let r = secureRandom() * total;
    for (const p of prizes) { r -= p.weight; if (r <= 0) return p; }
    return prizes[prizes.length - 1];
  });

  // Check 3+ matching
  const counts: Record<string, { count: number; prize: any }> = {};
  picked.forEach((p: any) => {
    if (p.value === 0) return;
    if (!counts[p.symbol]) counts[p.symbol] = { count: 0, prize: p };
    counts[p.symbol].count++;
  });
  let winAmount = 0, winLabel = "";
  for (const { count, prize } of Object.values(counts)) {
    if (count >= 3 && winAmount === 0) { winAmount = prize.value; winLabel = prize.label; }
  }

  // Create bet record
  const { data: betRecord } = await supabase.from("bets").insert({
    user_id: userId, game_type: "scratch", bet_amount: card.is_free ? 0 : Number(card.price), status: winAmount > 0 ? "won" : "lost", payout: winAmount,
  }).select("id").single();

  // Credit win
  if (winAmount > 0) {
    await supabase.rpc("update_wallet_balance", {
      _user_id: userId, _amount: winAmount, _type: "win",
      _description: `Raspadinha ${card.name}: ${winLabel} (R$ ${winAmount.toFixed(2)})`,
    });
  }

  return { prizes: picked, winAmount, winLabel, cardName: card.name, isFree: card.is_free };
}

// --- Crash point derivation ---
async function deriveCrashPoint(betId: string): Promise<number> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(betId));
  const hash = new Uint8Array(sig);
  const value = ((hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3]) >>> 0;
  const r = value / 0xffffffff;
  if (r < 0.03) return 1.0;
  return Math.max(1.0, parseFloat(((1 / (1 - r)) * 0.97).toFixed(2)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { game_type, bet_amount, card_id, bet_id, cashout_multiplier } = body;

    // --- Crash cashout ---
    if (game_type === "crash-cashout") {
      if (!bet_id || !cashout_multiplier || cashout_multiplier <= 0) {
        return new Response(JSON.stringify({ error: "Invalid params" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: bet } = await admin.from("bets").select("*")
        .eq("id", bet_id).eq("user_id", userId).eq("status", "pending").single();
      if (!bet) {
        return new Response(JSON.stringify({ error: "Bet not found or settled" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const crashPoint = await deriveCrashPoint(bet_id);
      if (cashout_multiplier >= crashPoint) {
        await admin.from("bets").update({ status: "lost", multiplier: crashPoint }).eq("id", bet_id);
        return new Response(JSON.stringify({ success: false, crashPoint }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payout = parseFloat((bet.bet_amount * cashout_multiplier).toFixed(2));
      await admin.from("bets").update({ status: "won", multiplier: cashout_multiplier, payout }).eq("id", bet_id);
      await admin.rpc("update_wallet_balance", {
        _user_id: userId, _amount: payout, _type: "win",
        _description: `Cashout Crash ${cashout_multiplier}x - R$${payout}`,
      });
      return new Response(JSON.stringify({ success: true, payout, crashPoint }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Scratch game ---
    if (game_type === "scratch") {
      if (!card_id) {
        return new Response(JSON.stringify({ error: "card_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await resolveScratch(admin, userId, card_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Other games require bet_amount ---
    if (!bet_amount || bet_amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid bet amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct bet
    const { error: betErr } = await admin.rpc("update_wallet_balance", {
      _user_id: userId, _amount: bet_amount, _type: "bet",
      _description: `Aposta ${game_type} - R$${bet_amount}`,
    });
    if (betErr) {
      const msg = betErr.message?.includes("Insufficient") ? "Saldo insuficiente" : betErr.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = {};

    switch (game_type) {
      case "slots": {
        const { data: betRec } = await admin.from("bets").insert({
          user_id: userId, game_type: "slots", bet_amount, status: "pending",
        }).select("id").single();
        const outcome = resolveSlots(bet_amount);
        result = outcome;
        if (outcome.winAmount > 0) {
          await admin.rpc("update_wallet_balance", {
            _user_id: userId, _amount: outcome.winAmount, _type: "win",
            _description: `Ganho Slots ${outcome.middleRow.join("")} - R$${outcome.winAmount}`,
          });
          if (betRec) await admin.from("bets").update({ status: "won", payout: outcome.winAmount }).eq("id", betRec.id);
        } else {
          if (betRec) await admin.from("bets").update({ status: "lost" }).eq("id", betRec.id);
        }
        break;
      }

      case "fortune-tiger": {
        const { data: betRec } = await admin.from("bets").insert({
          user_id: userId, game_type: "fortune-tiger", bet_amount, status: "pending",
        }).select("id").single();
        const outcome = resolveFortuneTiger(bet_amount);
        result = outcome;
        if (outcome.winAmount > 0) {
          await admin.rpc("update_wallet_balance", {
            _user_id: userId, _amount: outcome.winAmount, _type: "win",
            _description: `Ganho Fortune Tiger - R$${outcome.winAmount}`,
          });
          if (betRec) await admin.from("bets").update({ status: "won", payout: outcome.winAmount }).eq("id", betRec.id);
        } else {
          if (betRec) await admin.from("bets").update({ status: "lost" }).eq("id", betRec.id);
        }
        break;
      }

      case "crash": {
        const { data: betRec } = await admin.from("bets").insert({
          user_id: userId, game_type: "crash", bet_amount, status: "pending",
        }).select("id").single();
        result = { bet_id: betRec?.id };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid game type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("resolve-game error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
