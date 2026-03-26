import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ─────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-idempotency-key, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────

function generateRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function jsonResponse(data: unknown, status = 200, requestId?: string) {
  const headers: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };
  if (requestId) headers["x-request-id"] = requestId;
  return new Response(JSON.stringify(data), { status, headers });
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Rate Limiting (per merchant + per IP) ────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number): { allowed: boolean; remaining: number; resetAt: number; count: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: limit - 1, resetAt: now + 60_000, count: 1 };
  }
  entry.count++;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt, count: entry.count };
}

// IP-based rate limiting (300 req/min per IP across all merchants)
const IP_RATE_LIMIT = 300;
function checkIpRateLimit(ip: string): boolean {
  const rl = checkRateLimit(`ip:${ip}`, IP_RATE_LIMIT);
  return rl.allowed;
}

// ── Replay Attack Protection ────────────────────────
// Reject requests with timestamps older than 5 minutes
const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const usedNonces = new Map<string, number>(); // nonce → expiry timestamp

// Clean expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiry] of usedNonces) {
    if (now > expiry) usedNonces.delete(nonce);
  }
}, 60_000);

function validateTimestampAndNonce(
  req: Request,
  requestId: string
): { valid: true } | { valid: false; error: string } {
  const timestamp = req.headers.get("x-timestamp");
  if (!timestamp) return { valid: true }; // Optional but recommended

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return { valid: false, error: "x-timestamp must be a unix timestamp in milliseconds" };

  const now = Date.now();
  const diff = Math.abs(now - ts);
  if (diff > REPLAY_WINDOW_MS) {
    return { valid: false, error: "Request timestamp too old or too far in the future (5 min window)" };
  }

  // Check nonce (x-request-id acts as nonce)
  const nonce = req.headers.get("x-request-id") || requestId;
  const nonceKey = `${nonce}:${timestamp}`;
  if (usedNonces.has(nonceKey)) {
    return { valid: false, error: "Duplicate request detected (replay attack protection)" };
  }
  usedNonces.set(nonceKey, now + REPLAY_WINDOW_MS);

  return { valid: true };
}

// ── Schema Validation (Zero Trust) ──────────────────

interface ValidationRule {
  type: "string" | "number" | "object" | "boolean";
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  enum?: string[];
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

function validateSchema(
  body: Record<string, unknown>,
  schema: ValidationSchema,
  requestId: string
): { valid: true } | { valid: false; error: string; field: string } {
  // Block unexpected fields
  const allowedFields = new Set(Object.keys(schema));
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
      return { valid: false, error: `Unexpected field: ${key}`, field: key };
    }
  }

  // Validate each field
  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field];

    if (rule.required && (value === undefined || value === null || value === "")) {
      return { valid: false, error: `${field} is required`, field };
    }

    if (value === undefined || value === null) continue;

    // Type check
    if (rule.type === "number" && typeof value !== "number") {
      return { valid: false, error: `${field} must be a number`, field };
    }
    if (rule.type === "string" && typeof value !== "string") {
      return { valid: false, error: `${field} must be a string`, field };
    }
    if (rule.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
      return { valid: false, error: `${field} must be an object`, field };
    }
    if (rule.type === "boolean" && typeof value !== "boolean") {
      return { valid: false, error: `${field} must be a boolean`, field };
    }

    // Number range
    if (rule.type === "number" && typeof value === "number") {
      if (rule.min !== undefined && value < rule.min) {
        return { valid: false, error: `${field} must be >= ${rule.min}`, field };
      }
      if (rule.max !== undefined && value > rule.max) {
        return { valid: false, error: `${field} must be <= ${rule.max}`, field };
      }
    }

    // String length
    if (rule.type === "string" && typeof value === "string") {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        return { valid: false, error: `${field} must have at least ${rule.minLength} characters`, field };
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        return { valid: false, error: `${field} must have at most ${rule.maxLength} characters`, field };
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return { valid: false, error: `${field} has invalid format`, field };
      }
      if (rule.enum && !rule.enum.includes(value)) {
        return { valid: false, error: `${field} must be one of: ${rule.enum.join(", ")}`, field };
      }
    }
  }

  return { valid: true };
}

// Schemas for each endpoint
const PAYMENT_INTENT_SCHEMA: ValidationSchema = {
  amount: { type: "number", required: true, min: 0.01, max: 50000 },
  payment_method: { type: "string", enum: ["pix"], maxLength: 20 },
  description: { type: "string", maxLength: 500 },
  customer_email: { type: "string", maxLength: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  customer_document: { type: "string", maxLength: 20, pattern: /^[\d.\-\/]+$/ },
  metadata: { type: "object" },
};

const REFUND_SCHEMA: ValidationSchema = {
  transaction_id: { type: "string", maxLength: 36, pattern: /^[a-f0-9-]+$/ },
  payment_intent_id: { type: "string", maxLength: 36, pattern: /^[a-f0-9-]+$/ },
  reason: { type: "string", maxLength: 500 },
};

// ── Request Logger (Zero Trust) ─────────────────────

async function logRequest(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  merchantId: string,
  endpoint: string,
  method: string,
  ip: string,
  statusCode: number,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from("audit_log").insert({
      entity_type: "api_request",
      entity_id: requestId,
      action: `${method} ${endpoint}`,
      actor_type: "merchant",
      actor_id: merchantId,
      ip_address: ip,
      metadata: {
        request_id: requestId,
        merchant_id: merchantId,
        endpoint,
        method,
        status_code: statusCode,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  } catch {
    // Non-blocking log
  }
}

// ── Audit Logger ────────────────────────────────────

async function auditLog(
  supabase: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string,
  action: string,
  opts: { actorType?: string; actorId?: string; oldState?: unknown; newState?: unknown; metadata?: unknown; ip?: string; requestId?: string } = {}
) {
  await supabase.from("audit_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    actor_type: opts.actorType || "system",
    actor_id: opts.actorId,
    old_state: opts.oldState || null,
    new_state: opts.newState || null,
    metadata: { ...(opts.metadata as Record<string, unknown> || {}), request_id: opts.requestId },
    ip_address: opts.ip,
  });
}

// ── Provider Interface ──────────────────────────────

interface PaymentProvider {
  name: string;
  createPayment(params: ProviderPaymentParams): Promise<ProviderPaymentResult>;
}

interface ProviderPaymentParams {
  amount: number;
  transactionId: string;
  description?: string;
  customerEmail?: string;
  customerDocument?: string;
  webhookUrl: string;
}

interface ProviderPaymentResult {
  success: boolean;
  providerTransactionId?: string;
  pixQrcodeUrl?: string;
  pixCopyPaste?: string;
  rawResponse?: unknown;
  error?: string;
}

// ── MisticPay Provider ──────────────────────────────

function createMisticPayProvider(): PaymentProvider | null {
  const clientId = Deno.env.get("MISTICPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("MISTICPAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  return {
    name: "misticpay",
    async createPayment(params) {
      try {
        const res = await fetch("https://api.misticpay.com/api/transactions/create", {
          method: "POST",
          headers: { ci: clientId, cs: clientSecret, "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: params.amount,
            payerName: params.customerEmail || "Customer",
            payerDocument: params.customerDocument || "00000000000",
            transactionId: params.transactionId,
            description: params.description || `Payment - R$ ${params.amount.toFixed(2)}`,
            projectWebhook: params.webhookUrl,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          return {
            success: true,
            providerTransactionId: String(data.data?.transactionId || ""),
            pixQrcodeUrl: data.data?.qrcodeUrl || "",
            pixCopyPaste: data.data?.copyPaste || "",
            rawResponse: data,
          };
        }
        return { success: false, error: JSON.stringify(data), rawResponse: data };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  };
}

function getProvider(method: string): PaymentProvider | null {
  if (method === "pix") return createMisticPayProvider();
  return null;
}

// ── Auth Middleware (Zero Trust) ─────────────────────

async function authenticateMerchant(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
  requestId: string
): Promise<{ merchantId: string; rateLimit: number; error?: never } | { error: string; merchantId?: never; statusCode: number }> {
  const apiKey = req.headers.get("x-api-key");
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  // Validate key format strictly
  if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("gw_live_") || apiKey.length < 20 || apiKey.length > 100) {
    await supabaseAdmin.from("security_events").insert({
      event_type: "unauthorized_access",
      ip_address: ip,
      metadata: { reason: "invalid_api_key_format", request_id: requestId },
    });
    return { error: "Missing or invalid API key", statusCode: 401 };
  }

  const prefix = apiKey.substring(0, 12);
  const keyHash = await hashKey(apiKey);

  const { data: merchant, error } = await supabaseAdmin
    .from("merchants")
    .select("id, status, rate_limit_per_minute, api_key_hash")
    .eq("api_key_prefix", prefix)
    .eq("status", "active")
    .single();

  if (error || !merchant) {
    await supabaseAdmin.from("security_events").insert({
      event_type: "unauthorized_access",
      ip_address: ip,
      metadata: { reason: "merchant_not_found", prefix, request_id: requestId },
    });
    return { error: "Invalid API key", statusCode: 401 };
  }

  // Constant-time hash comparison
  if (merchant.api_key_hash !== keyHash) {
    await supabaseAdmin.from("security_events").insert({
      event_type: "unauthorized_access",
      ip_address: ip,
      merchant_id: merchant.id,
      metadata: { reason: "hash_mismatch", request_id: requestId },
    });
    return { error: "Invalid API key", statusCode: 401 };
  }

  // Rate limit with response headers
  const rl = checkRateLimit(merchant.id, merchant.rate_limit_per_minute);
  if (!rl.allowed) {
    // Log to both security_events and rate_limit_events
    await Promise.all([
      supabaseAdmin.from("security_events").insert({
        merchant_id: merchant.id,
        event_type: "rate_limit_hit",
        ip_address: ip,
        metadata: { limit: merchant.rate_limit_per_minute, request_id: requestId, count: rl.count },
      }),
      supabaseAdmin.from("rate_limit_events").insert({
        event_source: "gateway-api",
        identifier_type: "merchant_id",
        identifier_value: merchant.id,
        ip_address: ip,
        endpoint: "authenticateMerchant",
        limit_value: merchant.rate_limit_per_minute,
        current_count: rl.count,
        blocked: true,
      }),
      supabaseAdmin.from("system_alerts").insert({
        alert_type: "rate_limit_exceeded",
        severity: "warning",
        message: `Merchant ${merchant.id.slice(0, 8)} exceeded rate limit (${rl.count}/${merchant.rate_limit_per_minute} req/min)`,
        source: "gateway-api",
        metadata: { merchant_id: merchant.id, ip, limit: merchant.rate_limit_per_minute, count: rl.count },
      }),
    ]);
    return { error: "Rate limit exceeded. Retry after 60s.", statusCode: 429 };
  }

  return { merchantId: merchant.id, rateLimit: merchant.rate_limit_per_minute };
}

// ── Ownership Verification (Zero Trust) ─────────────

async function verifyResourceOwnership(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  resourceId: string,
  merchantId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("id", resourceId)
    .eq("merchant_id", merchantId)
    .single();
  return !!data;
}

// ── Safe JSON Parse ─────────────────────────────────

async function safeParseJSON(req: Request, maxSize = 65536): Promise<{ data: Record<string, unknown> } | { error: string }> {
  const contentType = req.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return { error: "Content-Type must be application/json" };
  }

  // Read with size limit
  const reader = req.body?.getReader();
  if (!reader) return { error: "Empty request body" };

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > maxSize) {
      reader.cancel();
      return { error: `Request body exceeds ${maxSize} bytes limit` };
    }
    chunks.push(value);
  }

  const bodyText = new TextDecoder().decode(
    chunks.length === 1 ? chunks[0] : new Uint8Array(chunks.reduce((acc, c) => [...acc, ...c], [] as number[]))
  );

  try {
    const parsed = JSON.parse(bodyText);
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
      return { error: "Request body must be a JSON object" };
    }
    return { data: parsed };
  } catch {
    return { error: "Invalid JSON" };
  }
}

// ── UUID Validation ─────────────────────────────────

function isValidUUID(str: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(str);
}

// ── Idempotency Layer ───────────────────────────────

async function checkIdempotency(
  supabaseAdmin: ReturnType<typeof createClient>,
  key: string,
  merchantId: string,
  endpoint: string,
  requestHash: string
): Promise<{ hit: true; status: number; body: unknown } | { hit: false }> {
  const { data } = await supabaseAdmin
    .from("idempotency_keys")
    .select("response_status, response_body, request_hash, expires_at")
    .eq("key", key)
    .eq("merchant_id", merchantId)
    .eq("endpoint", endpoint)
    .single();

  if (!data) return { hit: false };

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    // Clean up expired key
    await supabaseAdmin.from("idempotency_keys")
      .delete()
      .eq("key", key)
      .eq("merchant_id", merchantId)
      .eq("endpoint", endpoint);
    return { hit: false };
  }

  // If same key but different request body → conflict
  if (data.request_hash && data.request_hash !== requestHash) {
    return {
      hit: true,
      status: 409,
      body: { error: "Idempotency key already used with different request parameters" },
    };
  }

  return { hit: true, status: data.response_status, body: data.response_body };
}

async function storeIdempotency(
  supabaseAdmin: ReturnType<typeof createClient>,
  key: string,
  merchantId: string,
  endpoint: string,
  requestHash: string,
  responseStatus: number,
  responseBody: unknown
) {
  await supabaseAdmin.from("idempotency_keys").upsert({
    key,
    merchant_id: merchantId,
    endpoint,
    request_hash: requestHash,
    response_status: responseStatus,
    response_body: responseBody,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "key,merchant_id,endpoint" });
}

async function computeRequestHash(body: Record<string, unknown>): Promise<string> {
  const sorted = JSON.stringify(body, Object.keys(body).sort());
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(sorted));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ── Route: POST /payment-intents ─────────────────────

async function handleCreatePaymentIntent(
  req: Request,
  merchantId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  requestId: string
) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  // 1. Parse body with size limit
  const parseResult = await safeParseJSON(req);
  if ("error" in parseResult) {
    return jsonResponse({ error: parseResult.error, request_id: requestId }, 400, requestId);
  }
  const body = parseResult.data;

  // 2. Schema validation — block unexpected fields
  const validation = validateSchema(body, PAYMENT_INTENT_SCHEMA, requestId);
  if (!validation.valid) {
    await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, 400, {
      rejected_reason: validation.error, rejected_field: validation.field,
    });
    return jsonResponse({ error: validation.error, field: validation.field, request_id: requestId }, 400, requestId);
  }

  // 3. Extract ONLY whitelisted fields — ignore anything else
  const amount = body.amount as number;
  const payment_method = (body.payment_method as string) || "pix";
  const description = body.description as string | undefined;
  const customer_email = body.customer_email as string | undefined;
  const customer_document = body.customer_document as string | undefined;
  const metadata = body.metadata as Record<string, unknown> | undefined;

  // 4. Validate idempotency key from header (not body — Zero Trust)
  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return jsonResponse({ error: "x-idempotency-key header required (8-128 chars)", request_id: requestId }, 400, requestId);
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(idempotencyKey)) {
    return jsonResponse({ error: "x-idempotency-key must be alphanumeric", request_id: requestId }, 400, requestId);
  }

  // 5. Sanitize metadata — limit depth and size
  let safeMetadata: Record<string, unknown> = {};
  if (metadata) {
    const metaStr = JSON.stringify(metadata);
    if (metaStr.length > 4096) {
      return jsonResponse({ error: "metadata exceeds 4KB limit", request_id: requestId }, 400, requestId);
    }
    safeMetadata = metadata;
  }

  // 5.5 IDEMPOTENCY CHECK — return cached response if key already used
  const reqHash = await computeRequestHash({ amount, payment_method, description, customer_email, customer_document });
  const idempotencyCheck = await checkIdempotency(supabaseAdmin, idempotencyKey, merchantId, "payment-intents", reqHash);
  if (idempotencyCheck.hit) {
    await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, idempotencyCheck.status, {
      idempotency: "cache_hit", idempotency_key: idempotencyKey,
    });
    return jsonResponse(
      { ...(idempotencyCheck.body as Record<string, unknown>), request_id: requestId, idempotent_replay: true },
      idempotencyCheck.status,
      requestId
    );
  }

  // 6. Create payment intent via RPC (amount recalculated server-side)
  const { data: piId, error: piError } = await supabaseAdmin.rpc("create_payment_intent", {
    _merchant_id: merchantId,
    _amount: amount,
    _idempotency_key: idempotencyKey,
    _payment_method: payment_method,
    _description: description || null,
    _customer_email: customer_email || null,
    _customer_document: customer_document || null,
    _metadata: safeMetadata,
  });

  if (piError) {
    await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, 400, { rpc_error: piError.message });
    return jsonResponse({ error: piError.message, request_id: requestId }, 400, requestId);
  }

  // 7. Enhanced risk scoring (server-side, never trust client risk values)
  const { data: riskResult } = await supabaseAdmin.rpc("calculate_enhanced_risk", {
    _merchant_id: merchantId,
    _amount: amount,
    _customer_document: customer_document || null,
    _ip_address: ip,
  });

  const risk = riskResult || { score: 0, flags: [], decision: "allow" };

  // Record fraud score + system metric + alert if high risk
  const fraudInserts: Promise<any>[] = [
    supabaseAdmin.from("fraud_scores").insert({
      payment_intent_id: piId,
      merchant_id: merchantId,
      risk_score: risk.score,
      flags: risk.flags,
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
      decision: risk.decision,
    }),
    supabaseAdmin.from("system_metrics").insert({
      metric_name: "payment_created",
      metric_value: amount,
      tags: { merchant_id: merchantId, risk_score: risk.score, decision: risk.decision },
    }),
    supabaseAdmin.from("payment_intents").update({ risk_score: risk.score }).eq("id", piId),
  ];

  // Generate system alert for high-risk transactions
  if (risk.score >= 50) {
    fraudInserts.push(
      supabaseAdmin.from("system_alerts").insert({
        alert_type: "fraud_detected",
        severity: risk.score >= 90 ? "critical" : risk.score >= 70 ? "high" : "warning",
        message: `High risk payment detected: score ${risk.score}, decision: ${risk.decision}`,
        source: "gateway-api",
        metadata: {
          payment_intent_id: piId, merchant_id: merchantId, amount,
          risk_score: risk.score, flags: risk.flags, decision: risk.decision, ip,
        },
      })
    );
  }

  await Promise.all(fraudInserts);

  // 8. If blocked by fraud
  if (risk.decision === "block") {
    await supabaseAdmin.rpc("update_payment_intent_status", { _pi_id: piId, _new_status: "cancelled" });
    await supabaseAdmin.from("security_events").insert({
      merchant_id: merchantId,
      event_type: "high_risk_transaction",
      ip_address: ip,
      metadata: { payment_intent_id: piId, risk_score: risk.score, flags: risk.flags, amount, request_id: requestId },
    });
    await auditLog(supabaseAdmin, "payment_intent", piId, "blocked_by_fraud", {
      actorType: "system", metadata: risk, ip, requestId,
    });
    await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, 201, { result: "blocked" });
    const blockedBody = {
      id: piId, object: "payment_intent", status: "cancelled",
      risk: { score: risk.score, decision: "block" }, request_id: requestId,
    };
    await storeIdempotency(supabaseAdmin, idempotencyKey, merchantId, "payment-intents", reqHash, 201, blockedBody);
    return jsonResponse(blockedBody, 201, requestId);
  }

  // 9. Create gateway transaction via RPC (financial values computed server-side)
  const { data: txId, error: txError } = await supabaseAdmin.rpc("create_gateway_transaction", {
    _merchant_id: merchantId,
    _amount: amount,
    _idempotency_key: idempotencyKey,
    _payment_method: payment_method,
    _description: description || null,
    _customer_email: customer_email || null,
    _customer_document: customer_document || null,
    _metadata: { ...safeMetadata, payment_intent_id: piId, request_id: requestId },
  });

  if (txError) {
    await supabaseAdmin.rpc("update_payment_intent_status", { _pi_id: piId, _new_status: "failed" });
    await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, 400, { rpc_error: txError.message });
    return jsonResponse({ error: txError.message, request_id: requestId }, 400, requestId);
  }

  // Link PI → GW TX
  await supabaseAdmin.from("payment_intents").update({ gateway_transaction_id: txId }).eq("id", piId);
  await supabaseAdmin.from("fraud_scores").update({ transaction_id: txId }).eq("payment_intent_id", piId).is("transaction_id", null);
  await supabaseAdmin.from("gateway_transactions").update({ risk_score: risk.score }).eq("id", txId);

  // 10. If needs review
  if (risk.decision === "review") {
    await supabaseAdmin.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "review_required" });
    await supabaseAdmin.from("security_events").insert({
      merchant_id: merchantId, event_type: "high_risk_transaction", ip_address: ip,
      metadata: { payment_intent_id: piId, transaction_id: txId, risk_score: risk.score, flags: risk.flags, request_id: requestId },
    });
    await auditLog(supabaseAdmin, "payment_intent", piId, "sent_to_review", { actorType: "system", metadata: { risk, txId }, ip, requestId });

    const { data: pi } = await supabaseAdmin.from("payment_intents")
      .select("id, status, amount, currency, payment_method, provider, risk_score, created_at")
      .eq("id", piId).single();
    await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, 201, { result: "review" });
    const reviewBody = { ...pi, object: "payment_intent", risk: { score: risk.score, decision: "review" }, request_id: requestId };
    await storeIdempotency(supabaseAdmin, idempotencyKey, merchantId, "payment-intents", reqHash, 201, reviewBody);
    return jsonResponse(reviewBody, 201, requestId);
  }

  // 11. Process with provider
  const provider = getProvider(payment_method);

  if (!provider) {
    await supabaseAdmin.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "processing" });
    await supabaseAdmin.rpc("update_payment_intent_status", { _pi_id: piId, _new_status: "processing" });
    await supabaseAdmin.from("payment_attempts").insert({
      transaction_id: txId, provider: payment_method, status: "failed", error_message: "Provider not configured",
    });
    await auditLog(supabaseAdmin, "payment_intent", piId, "provider_not_configured", { ip, requestId });

    const { data: pi } = await supabaseAdmin.from("payment_intents")
      .select("id, status, amount, currency, payment_method, provider, risk_score, created_at")
      .eq("id", piId).single();
    await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, 201, { result: "no_provider" });
    return jsonResponse({ ...pi, object: "payment_intent", message: "Awaiting provider configuration", request_id: requestId }, 201, requestId);
  }

  // Call provider
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const misticSecret = Deno.env.get("MISTICPAY_CLIENT_SECRET")!;
  const webhookToken = await hashKey(misticSecret + ":gateway-webhook");

  const providerResult = await provider.createPayment({
    amount,
    transactionId: txId,
    description,
    customerEmail: customer_email,
    customerDocument: customer_document,
    webhookUrl: `${supabaseUrl}/functions/v1/gateway-webhook?token=${webhookToken.slice(0, 32)}`,
  });

  await supabaseAdmin.from("payment_attempts").insert({
    transaction_id: txId, provider: provider.name,
    status: providerResult.success ? "success" : "failed",
    provider_response: providerResult.rawResponse || null,
    error_message: providerResult.error || null,
  });

  if (providerResult.success) {
    await supabaseAdmin.from("gateway_transactions").update({
      provider_transaction_id: providerResult.providerTransactionId || "",
      pix_qrcode_url: providerResult.pixQrcodeUrl || "",
      pix_copy_paste: providerResult.pixCopyPaste || "",
    }).eq("id", txId);

    await supabaseAdmin.rpc("update_gateway_tx_status", { _tx_id: txId, _new_status: "processing" });
    await supabaseAdmin.rpc("update_payment_intent_status", { _pi_id: piId, _new_status: "processing", _gateway_tx_id: txId });

    await supabaseAdmin.from("processing_queue").insert({
      queue_name: "reconciliation",
      payload: { payment_intent_id: piId, transaction_id: txId, request_id: requestId, check_after: new Date(Date.now() + 30 * 60000).toISOString() },
      scheduled_at: new Date(Date.now() + 30 * 60000).toISOString(),
    });

    await auditLog(supabaseAdmin, "payment_intent", piId, "payment_initiated", {
      actorType: "merchant", actorId: merchantId,
      newState: { status: "processing", provider: provider.name, txId },
      ip, requestId,
    });
  } else {
    await auditLog(supabaseAdmin, "payment_intent", piId, "provider_error", {
      metadata: { error: providerResult.error, provider: provider.name }, ip, requestId,
    });
  }

  const { data: finalTx } = await supabaseAdmin.from("gateway_transactions")
    .select("pix_qrcode_url, pix_copy_paste").eq("id", txId).single();

  const { data: finalPi } = await supabaseAdmin.from("payment_intents")
    .select("id, status, amount, currency, payment_method, provider, risk_score, created_at")
    .eq("id", piId).single();

  await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents", "POST", ip, 201, { result: "success", piId, txId });

  const responseBody = {
    ...finalPi, object: "payment_intent", transaction_id: txId,
    pix: finalTx ? { qrcode_url: finalTx.pix_qrcode_url, copy_paste: finalTx.pix_copy_paste } : null,
    risk: { score: risk.score, decision: risk.decision },
    request_id: requestId,
  };

  // Store idempotency key for future duplicate detection
  await storeIdempotency(supabaseAdmin, idempotencyKey, merchantId, "payment-intents", reqHash, 201, responseBody);

  return jsonResponse(responseBody, 201, requestId);
}

// ── Route: GET /payment-intents/:id ──────────────────

async function handleGetPaymentIntent(
  merchantId: string,
  piId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  requestId: string
) {
  // Validate UUID format
  if (!isValidUUID(piId)) {
    return jsonResponse({ error: "Invalid payment intent ID format", request_id: requestId }, 400, requestId);
  }

  // Ownership verified via merchant_id filter
  const { data: pi, error } = await supabaseAdmin.from("payment_intents")
    .select("id, status, amount, currency, payment_method, provider, risk_score, gateway_transaction_id, description, created_at, updated_at, succeeded_at, failed_at, cancelled_at")
    .eq("id", piId).eq("merchant_id", merchantId).single();

  if (error || !pi) return jsonResponse({ error: "Payment intent not found", request_id: requestId }, 404, requestId);

  let pix = null;
  if (pi.gateway_transaction_id) {
    // Verify tx also belongs to this merchant (defense in depth)
    const { data: tx } = await supabaseAdmin.from("gateway_transactions")
      .select("pix_qrcode_url, pix_copy_paste, provider_transaction_id, status")
      .eq("id", pi.gateway_transaction_id).eq("merchant_id", merchantId).single();
    if (tx) pix = { qrcode_url: tx.pix_qrcode_url, copy_paste: tx.pix_copy_paste, provider_tx_id: tx.provider_transaction_id, gateway_status: tx.status };
  }

  return jsonResponse({ ...pi, object: "payment_intent", pix, request_id: requestId }, 200, requestId);
}

// ── Route: POST /payment-intents/:id/cancel ──────────

async function handleCancelIntent(
  merchantId: string,
  piId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  ip: string,
  requestId: string
) {
  if (!isValidUUID(piId)) {
    return jsonResponse({ error: "Invalid payment intent ID format", request_id: requestId }, 400, requestId);
  }

  // Ownership check
  const { data: pi } = await supabaseAdmin.from("payment_intents")
    .select("id, status, gateway_transaction_id")
    .eq("id", piId).eq("merchant_id", merchantId).single();

  if (!pi) return jsonResponse({ error: "Payment intent not found", request_id: requestId }, 404, requestId);
  if (pi.status === "succeeded" || pi.status === "cancelled") {
    return jsonResponse({ error: `Cannot cancel intent in ${pi.status} state`, request_id: requestId }, 400, requestId);
  }

  await supabaseAdmin.rpc("update_payment_intent_status", { _pi_id: piId, _new_status: "cancelled" });

  if (pi.gateway_transaction_id) {
    try {
      await supabaseAdmin.rpc("update_gateway_tx_status", { _tx_id: pi.gateway_transaction_id, _new_status: "cancelled" });
    } catch { /* transition may not be valid */ }
  }

  await auditLog(supabaseAdmin, "payment_intent", piId, "cancelled", {
    actorType: "merchant", actorId: merchantId, oldState: { status: pi.status }, ip, requestId,
  });

  await logRequest(supabaseAdmin, requestId, merchantId, "POST /payment-intents/:id/cancel", "POST", ip, 200);

  return jsonResponse({ id: piId, object: "payment_intent", status: "cancelled", request_id: requestId }, 200, requestId);
}

// ── Route: GET /payments/:id (legacy) ────────────────

async function handleGetPayment(merchantId: string, paymentId: string, supabaseAdmin: ReturnType<typeof createClient>, requestId: string) {
  if (!isValidUUID(paymentId)) {
    return jsonResponse({ error: "Invalid transaction ID format", request_id: requestId }, 400, requestId);
  }

  const { data: tx, error } = await supabaseAdmin.from("gateway_transactions")
    .select("id, status, amount, currency, payment_method, description, risk_score, pix_qrcode_url, pix_copy_paste, paid_at, created_at, updated_at")
    .eq("id", paymentId).eq("merchant_id", merchantId).single();

  if (error || !tx) return jsonResponse({ error: "Transaction not found", request_id: requestId }, 404, requestId);
  return jsonResponse({ ...tx, request_id: requestId }, 200, requestId);
}

// ── Route: GET /transactions (list) ──────────────────

async function handleListTransactions(merchantId: string, url: URL, supabaseAdmin: ReturnType<typeof createClient>, requestId: string) {
  const page = Math.max(1, Math.min(parseInt(url.searchParams.get("page") || "1") || 1, 1000));
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get("limit") || "20") || 20, 100));
  const status = url.searchParams.get("status");
  const offset = (page - 1) * limit;

  // Validate status enum if provided
  const validStatuses = ["pending", "processing", "paid", "failed", "refunded", "cancelled", "review_required"];
  if (status && !validStatuses.includes(status)) {
    return jsonResponse({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, request_id: requestId }, 400, requestId);
  }

  let query = supabaseAdmin.from("gateway_transactions")
    .select("id, status, amount, currency, payment_method, description, risk_score, paid_at, created_at", { count: "exact" })
    .eq("merchant_id", merchantId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  const { data, error, count } = await query;
  if (error) return jsonResponse({ error: "Failed to fetch transactions", request_id: requestId }, 500, requestId);

  return jsonResponse({ data, pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) }, request_id: requestId }, 200, requestId);
}

// ── Route: GET /payment-intents (list) ───────────────

async function handleListPaymentIntents(merchantId: string, url: URL, supabaseAdmin: ReturnType<typeof createClient>, requestId: string) {
  const page = Math.max(1, Math.min(parseInt(url.searchParams.get("page") || "1") || 1, 1000));
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get("limit") || "20") || 20, 100));
  const status = url.searchParams.get("status");
  const offset = (page - 1) * limit;

  const validStatuses = ["requires_payment", "processing", "succeeded", "failed", "cancelled"];
  if (status && !validStatuses.includes(status)) {
    return jsonResponse({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, request_id: requestId }, 400, requestId);
  }

  let query = supabaseAdmin.from("payment_intents")
    .select("id, status, amount, currency, payment_method, provider, risk_score, description, created_at", { count: "exact" })
    .eq("merchant_id", merchantId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status as any);
  const { data, error, count } = await query;
  if (error) return jsonResponse({ error: "Failed to fetch payment intents", request_id: requestId }, 500, requestId);

  return jsonResponse({
    data: data?.map(d => ({ ...d, object: "payment_intent" })),
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
    request_id: requestId,
  }, 200, requestId);
}

// ── Route: POST /refunds ─────────────────────────────

async function handleCreateRefund(req: Request, merchantId: string, supabaseAdmin: ReturnType<typeof createClient>, requestId: string) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const parseResult = await safeParseJSON(req);
  if ("error" in parseResult) {
    return jsonResponse({ error: parseResult.error, request_id: requestId }, 400, requestId);
  }

  const validation = validateSchema(parseResult.data, REFUND_SCHEMA, requestId);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error, field: validation.field, request_id: requestId }, 400, requestId);
  }

  const { transaction_id, payment_intent_id, reason } = parseResult.data as { transaction_id?: string; payment_intent_id?: string; reason?: string };

  // Resolve transaction_id
  let resolvedTxId = transaction_id;
  if (payment_intent_id && !transaction_id) {
    if (!isValidUUID(payment_intent_id)) return jsonResponse({ error: "Invalid payment_intent_id", request_id: requestId }, 400, requestId);
    const { data: pi } = await supabaseAdmin.from("payment_intents")
      .select("gateway_transaction_id").eq("id", payment_intent_id).eq("merchant_id", merchantId).single();
    if (!pi?.gateway_transaction_id) return jsonResponse({ error: "Payment intent has no transaction", request_id: requestId }, 400, requestId);
    resolvedTxId = pi.gateway_transaction_id;
  }

  if (!resolvedTxId) return jsonResponse({ error: "transaction_id or payment_intent_id required", request_id: requestId }, 400, requestId);
  if (!isValidUUID(resolvedTxId)) return jsonResponse({ error: "Invalid transaction_id", request_id: requestId }, 400, requestId);

  // Ownership check
  const { data: tx, error } = await supabaseAdmin.from("gateway_transactions")
    .select("id, status, amount, merchant_id").eq("id", resolvedTxId).eq("merchant_id", merchantId).single();

  if (error || !tx) return jsonResponse({ error: "Transaction not found", request_id: requestId }, 404, requestId);
  if (tx.status !== "paid") return jsonResponse({ error: "Only paid transactions can be refunded", request_id: requestId }, 400, requestId);

  const { error: refundError } = await supabaseAdmin.rpc("update_gateway_tx_status", {
    _tx_id: resolvedTxId, _new_status: "refunded",
  });

  if (refundError) return jsonResponse({ error: refundError.message, request_id: requestId }, 400, requestId);

  if (payment_intent_id) {
    await supabaseAdmin.rpc("update_payment_intent_status", { _pi_id: payment_intent_id, _new_status: "failed" });
  }

  await supabaseAdmin.from("webhook_deliveries").insert({
    merchant_id: merchantId, transaction_id: resolvedTxId,
    event_type: "payment.refunded",
    payload: { transaction_id: resolvedTxId, amount: tx.amount, reason: reason || "Merchant requested refund", request_id: requestId },
    status: "pending", next_retry_at: new Date().toISOString(),
  });

  await auditLog(supabaseAdmin, "gateway_transaction", resolvedTxId, "refunded", {
    actorType: "merchant", actorId: merchantId,
    metadata: { amount: tx.amount, reason, request_id: requestId }, ip, requestId,
  });

  await logRequest(supabaseAdmin, requestId, merchantId, "POST /refunds", "POST", ip, 200, { txId: resolvedTxId });

  return jsonResponse({ id: resolvedTxId, object: "refund", status: "refunded", request_id: requestId }, 200, requestId);
}

// ── Route: GET /balance ──────────────────────────────

async function handleGetBalance(merchantId: string, supabaseAdmin: ReturnType<typeof createClient>, requestId: string) {
  const { data: balance } = await supabaseAdmin.rpc("get_merchant_balance", { _merchant_id: merchantId });
  const { data: ledger } = await supabaseAdmin.from("ledger_entries")
    .select("id, entry_type, amount, balance_after, description, created_at")
    .eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(20);

  return jsonResponse({ balance: balance || 0, currency: "BRL", recent_entries: ledger || [], request_id: requestId }, 200, requestId);
}

// ── Route: GET /health ───────────────────────────────

async function handleHealth(requestId: string) {
  return jsonResponse({ status: "healthy", timestamp: new Date().toISOString(), version: "3.0.0-zero-trust", request_id: requestId }, 200, requestId);
}

// ── Main Router ──────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = req.headers.get("x-request-id") || generateRequestId();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/gateway-api\/?/, "").replace(/\/$/, "");
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  if (path === "health" && req.method === "GET") return handleHealth(requestId);

  // IP-based rate limiting (before auth, catches brute force)
  if (!checkIpRateLimit(ip)) {
    // Log IP rate limit (fire and forget, don't block response)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sbForLog = createClient(supabaseUrl, serviceRoleKey);
    sbForLog.from("rate_limit_events").insert({
      event_source: "gateway-api",
      identifier_type: "ip",
      identifier_value: ip,
      ip_address: ip,
      endpoint: path,
      limit_value: IP_RATE_LIMIT,
      current_count: IP_RATE_LIMIT + 1,
      blocked: true,
    }).then(() => {});
    return jsonResponse({
      error: "Too many requests from this IP",
      request_id: requestId,
    }, 429, requestId);
  }

  // Replay attack protection
  const replayCheck = validateTimestampAndNonce(req, requestId);
  if (!replayCheck.valid) {
    return jsonResponse({ error: replayCheck.error, request_id: requestId }, 400, requestId);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Authenticate
  const auth = await authenticateMerchant(req, supabaseAdmin, requestId);
  if (auth.error) {
    const status = auth.statusCode || 401;
    await logRequest(supabaseAdmin, requestId, "unknown", `${req.method} /${path}`, req.method, ip, status, { error: auth.error });
    return jsonResponse({ error: auth.error, request_id: requestId }, status, requestId);
  }

  const merchantId = auth.merchantId;

  try {
    // ── Payment Intents (v2) ──
    if (path === "payment-intents" && req.method === "POST") {
      return handleCreatePaymentIntent(req, merchantId, supabaseAdmin, requestId);
    }
    if (path === "payment-intents" && req.method === "GET") {
      return handleListPaymentIntents(merchantId, url, supabaseAdmin, requestId);
    }
    const piMatch = path.match(/^payment-intents\/([a-f0-9-]+)$/);
    if (piMatch && req.method === "GET") {
      return handleGetPaymentIntent(merchantId, piMatch[1], supabaseAdmin, requestId);
    }
    const piCancelMatch = path.match(/^payment-intents\/([a-f0-9-]+)\/cancel$/);
    if (piCancelMatch && req.method === "POST") {
      return handleCancelIntent(merchantId, piCancelMatch[1], supabaseAdmin, ip, requestId);
    }

    // ── Legacy routes ──
    if (path === "payments" && req.method === "POST") {
      return handleCreatePaymentIntent(req, merchantId, supabaseAdmin, requestId);
    }
    const paymentMatch = path.match(/^payments\/([a-f0-9-]+)$/);
    if (paymentMatch && req.method === "GET") {
      return handleGetPayment(merchantId, paymentMatch[1], supabaseAdmin, requestId);
    }
    if (path === "transactions" && req.method === "GET") {
      return handleListTransactions(merchantId, url, supabaseAdmin, requestId);
    }
    if (path === "refunds" && req.method === "POST") {
      return handleCreateRefund(req, merchantId, supabaseAdmin, requestId);
    }
    if (path === "balance" && req.method === "GET") {
      return handleGetBalance(merchantId, supabaseAdmin, requestId);
    }

    await logRequest(supabaseAdmin, requestId, merchantId, `${req.method} /${path}`, req.method, ip, 404);
    return jsonResponse({ error: "Not found", request_id: requestId }, 404, requestId);
  } catch (err) {
    console.error(`[${requestId}] Gateway API error:`, err);
    await logRequest(supabaseAdmin, requestId, merchantId, `${req.method} /${path}`, req.method, ip, 500, { error: String(err) });
    return jsonResponse({ error: "Internal server error", request_id: requestId }, 500, requestId);
  }
});
