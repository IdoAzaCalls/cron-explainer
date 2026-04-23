import type { Env } from "../worker";
import { decrementBalance, refundBalance } from "../lib/keystore";

/**
 * Billing middleware — prepaid API keys.
 *
 * Modes (driven by `env.BILLING_MODE`):
 *
 *   "test" (default): passthrough; tags response header `x-billing: test`.
 *                     Used for health checks and pre-launch verification.
 *
 *   "live":           require `x-api-key` header; look up the key in KV;
 *                     decrement 1 call (unit price) before calling `next`;
 *                     refund on non-2xx response.
 *
 * Key acquisition: users buy keys via `/v1/checkout` → Stripe Checkout →
 * `/v1/checkout/success` mints a key and binds it to a balance.
 */

export type NextHandler = (request: Request) => Promise<Response>;

export async function withBilling(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  next: NextHandler
): Promise<Response> {
  const mode = (env.BILLING_MODE ?? "test").toLowerCase();

  if (mode !== "live") {
    const res = await next(request);
    const wrapped = new Response(res.body, res);
    wrapped.headers.set("x-billing", "test");
    return wrapped;
  }

  // Live mode — KV must be bound
  const kv = env.KEYS;
  if (!kv) {
    return new Response(
      JSON.stringify({ error: "billing_misconfigured", detail: "KEYS KV binding missing." }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }

  const apiKey = request.headers.get("x-api-key") ?? "";
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "auth_required", detail: "Provide an x-api-key header. Buy a key at /." }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  const unit = Number(env.PRICE_PER_CALL_EUR_CENTS ?? "1");

  const dec = await decrementBalance(kv, apiKey, unit);
  if (dec === null) {
    return new Response(
      JSON.stringify({ error: "invalid_key", detail: "Unknown API key." }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }
  if (dec === "insufficient") {
    return new Response(
      JSON.stringify({
        error: "payment_required",
        detail: "Balance exhausted. Top up at /.",
      }),
      { status: 402, headers: { "content-type": "application/json" } }
    );
  }

  // Balance decremented; call the handler. Refund on any non-2xx so buyers
  // aren't charged for server errors or 400 validation failures.
  let res: Response;
  try {
    res = await next(request);
  } catch (err) {
    await refundBalance(kv, apiKey, unit).catch(() => {});
    throw err;
  }
  if (res.status < 200 || res.status >= 300) {
    await refundBalance(kv, apiKey, unit).catch(() => {});
  }

  const wrapped = new Response(res.body, res);
  wrapped.headers.set("x-billing", "live");
  wrapped.headers.set("x-balance-cents", String(dec.balance_cents));
  return wrapped;
}
