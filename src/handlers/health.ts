import type { Env } from "../worker";

export async function handleHealth(env: Env): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: "ok",
      brand: env.BRAND ?? "cron-explainer",
      env: env.ENVIRONMENT ?? "development",
      billing_mode: env.BILLING_MODE ?? "test",
      price_id: env.STRIPE_PRICE_ID ?? null,
      unit_price_minor: Number(env.PRICE_PER_CALL_EUR_CENTS ?? "1"),
      currency: "EUR",
      version: "0.1.0",
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
