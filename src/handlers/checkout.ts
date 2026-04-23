import type { Env } from "../worker";
import { createCheckoutSession } from "../lib/stripe";

interface CheckoutInput {
  quantity?: number; // number of /v1/explain calls to buy; default 500 (€5)
  email?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ALLOWED_QUANTITIES = new Set([500, 5000, 50000]);

export async function handleCheckout(request: Request, env: Env): Promise<Response> {
  const priceId = env.STRIPE_PRICE_ID;
  if (!priceId) return json({ error: "checkout_misconfigured", detail: "price_id_missing" }, 503);
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "checkout_misconfigured", detail: "stripe_secret_missing" }, 503);
  }
  const baseUrl = env.BASE_URL;
  if (!baseUrl) return json({ error: "checkout_misconfigured", detail: "base_url_missing" }, 503);

  let input: CheckoutInput = {};
  if (request.method === "POST") {
    try {
      const raw = await request.text();
      if (raw) input = JSON.parse(raw) as CheckoutInput;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
  }

  const quantity = Math.floor(Number(input.quantity ?? 500));
  if (!ALLOWED_QUANTITIES.has(quantity)) {
    return json(
      {
        error: "invalid_quantity",
        detail: `quantity must be one of ${[...ALLOWED_QUANTITIES].join(", ")}`,
      },
      400
    );
  }

  const success_url = `${baseUrl}/v1/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = `${baseUrl}/v1/checkout/cancel`;

  try {
    const session = await createCheckoutSession(env, {
      price_id: priceId,
      quantity,
      success_url,
      cancel_url,
      customer_email: input.email,
      metadata: { calls: String(quantity), service: "cron-explainer" },
    });
    return json({ id: session.id, url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return json({ error: "checkout_create_failed", detail: msg }, 502);
  }
}
