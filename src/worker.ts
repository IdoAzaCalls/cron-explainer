/**
 * cron-explainer — Cloudflare Worker entrypoint.
 *
 * Routes:
 *   GET  /                        → landing page (pricing + buy buttons)
 *   POST /v1/explain              → parse + describe + next fire times (billed)
 *   GET  /v1/balance              → remaining balance for an x-api-key
 *   POST /v1/checkout             → create Stripe Checkout Session
 *   GET  /v1/checkout/success     → verify payment, mint api key
 *   GET  /v1/checkout/cancel      → cancel landing
 *   GET  /legal/{tos,privacy,disclaimer,notices}  → rendered legal docs
 *   GET  /health                  → liveness probe
 *   GET  /v1/schema               → JSON Schema of /explain input/output
 *   GET  /.well-known/mcp.json    → MCP static manifest (AICo format)
 *   POST /mcp                     → MCP Streamable HTTP (JSON-RPC 2.0)
 *
 * Legal / compliance conditions (see AICompany/state/COMPLIANCE_LOG.md
 * D-20260422-03):
 *   - No payload logging. Logs carry metadata only.
 *   - "Best-effort" language only; no uptime/accuracy claims.
 *   - OSS NOTICES served at /legal/notices (docs/notices.md).
 */

import { handleExplain } from "./handlers/explain";
import { handleHealth } from "./handlers/health";
import { handleSchema } from "./handlers/schema";
import { handleMcp } from "./handlers/mcp";
import { handleMcpServer } from "./handlers/mcp_server";
import { withBilling } from "./middleware/billing";
import { handleCheckout } from "./handlers/checkout";
import { handleCheckoutSuccess } from "./handlers/checkout_success";
import { handleLanding, handleCheckoutCancel, handleBalance } from "./handlers/landing";
import { handleTos, handlePrivacy, handleDisclaimer, handleNotices } from "./handlers/legal";

export interface Env {
  DEFAULT_TZ?: string;
  MAX_N?: string;
  BRAND?: string;
  ENVIRONMENT?: string;
  BILLING_MODE?: string; // "test" | "live"
  PRICE_PER_CALL_EUR_CENTS?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_PRODUCT_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ACP_ISSUER_URL?: string;
  BASE_URL?: string;
  KEYS?: KVNamespace;
}

function logLine(record: Record<string, unknown>): void {
  // Structured JSON only. NEVER include request/response bodies.
  console.log(JSON.stringify(record));
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  if (method === "GET" && path === "/") return handleLanding(request, env);
  if (method === "GET" && path === "/health") return handleHealth(env);
  if (method === "GET" && path === "/v1/schema") return handleSchema(env);
  if (method === "GET" && path === "/.well-known/mcp.json") return handleMcp(env);
  if (method === "POST" && path === "/v1/checkout") return handleCheckout(request, env);
  if (method === "GET" && path === "/v1/checkout/success") return handleCheckoutSuccess(request, env);
  if (method === "GET" && path === "/v1/checkout/cancel") return handleCheckoutCancel();
  if (method === "GET" && path === "/v1/balance") return handleBalance(request, env);
  if (method === "GET" && path === "/legal/tos") return handleTos(request, env);
  if (method === "GET" && path === "/legal/privacy") return handlePrivacy(request, env);
  if (method === "GET" && path === "/legal/disclaimer") return handleDisclaimer(request, env);
  if (method === "GET" && path === "/legal/notices") return handleNotices(request, env);
  if (method === "POST" && path === "/v1/explain") {
    return withBilling(request, env, ctx, (req) => handleExplain(req, env));
  }
  if (path === "/mcp") return handleMcpServer(request, env, ctx);

  return new Response(JSON.stringify({ error: "not_found", path }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = crypto.randomUUID();
    const t0 = Date.now();
    let status = 0;
    let byteCount = 0;
    const callerId = request.headers.get("x-acp-caller") ?? "anon";

    try {
      const res = await route(request, env, ctx);
      status = res.status;
      // Best-effort byte count. We do not read the body here to avoid
      // consuming it — Workers `Response` does not expose a stable length
      // for streamed bodies, so we rely on content-length if present.
      const cl = res.headers.get("content-length");
      byteCount = cl ? Number(cl) : 0;

      const wrapped = new Response(res.body, res);
      wrapped.headers.set("x-request-id", requestId);
      return wrapped;
    } catch (err) {
      status = 500;
      const msg = err instanceof Error ? err.message : "unknown_error";
      return new Response(
        JSON.stringify({ error: "internal_error", request_id: requestId, message: msg }),
        { status: 500, headers: { "content-type": "application/json", "x-request-id": requestId } }
      );
    } finally {
      logLine({
        request_id: requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status,
        latency_ms: Date.now() - t0,
        byte_count: byteCount,
        caller_id: callerId,
        timestamp: new Date().toISOString(),
      });
    }
  },
};
