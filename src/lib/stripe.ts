/**
 * Minimal Stripe REST client for the Workers runtime.
 * We use only Checkout Sessions (create + retrieve) — no SDK needed.
 */

import type { Env } from "../worker";

const API = "https://api.stripe.com/v1";

function authHeader(env: Env): string {
  const key = env.STRIPE_SECRET_KEY ?? "";
  if (!key) throw new Error("stripe_secret_missing");
  return `Bearer ${key}`;
}

function toForm(params: Record<string, string | number | undefined | null>): string {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.append(k, String(v));
  }
  return body.toString();
}

export interface CheckoutSession {
  id: string;
  url: string;
  payment_status: "unpaid" | "paid" | "no_payment_required";
  amount_total: number | null;
  customer_details?: { email?: string };
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(
  env: Env,
  opts: {
    price_id: string;
    quantity: number;
    success_url: string;
    cancel_url: string;
    customer_email?: string;
    metadata?: Record<string, string>;
  }
): Promise<CheckoutSession> {
  const params: Record<string, string | number> = {
    mode: "payment",
    success_url: opts.success_url,
    cancel_url: opts.cancel_url,
    "line_items[0][price]": opts.price_id,
    "line_items[0][quantity]": opts.quantity,
    "payment_method_types[0]": "card",
    // Auto-apply Stripe Tax if the account has it enabled; harmless if it's not.
    "automatic_tax[enabled]": "true",
  };
  if (opts.customer_email) params["customer_email"] = opts.customer_email;
  if (opts.metadata) {
    for (const [k, v] of Object.entries(opts.metadata)) params[`metadata[${k}]`] = v;
  }

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      authorization: authHeader(env),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: toForm(params),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`stripe_checkout_create_failed: ${res.status} ${detail.slice(0, 500)}`);
  }
  return (await res.json()) as CheckoutSession;
}

export async function retrieveCheckoutSession(
  env: Env,
  session_id: string
): Promise<CheckoutSession> {
  const res = await fetch(`${API}/checkout/sessions/${encodeURIComponent(session_id)}`, {
    headers: { authorization: authHeader(env) },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`stripe_checkout_retrieve_failed: ${res.status} ${detail.slice(0, 500)}`);
  }
  return (await res.json()) as CheckoutSession;
}
