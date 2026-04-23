import type { Env } from "../worker";
import { retrieveCheckoutSession } from "../lib/stripe";
import {
  bindSessionToKey,
  getKeyForSession,
  getKeyRecord,
  putKeyRecord,
  type KeyRecord,
} from "../lib/keystore";
import { generateApiKey } from "../lib/idgen";

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function successPage(apiKey: string, quantity: number, email: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>cron-explainer — your API key</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:680px;margin:3rem auto;padding:0 1rem;color:#111;line-height:1.5}
  h1{font-size:1.6rem;margin-bottom:.25rem}
  code{background:#f3f3f3;padding:.15rem .4rem;border-radius:4px;font-size:.95em}
  pre{background:#111;color:#eee;padding:1rem;border-radius:8px;overflow-x:auto;font-size:.9rem}
  .key{background:#0a7;color:#fff;padding:1rem;border-radius:8px;font-family:ui-monospace,Menlo,monospace;word-break:break-all;font-size:1rem;margin:.5rem 0 1rem}
  .warn{background:#fff4cf;border:1px solid #e6c100;padding:.75rem 1rem;border-radius:8px;margin:1rem 0}
</style></head><body>
<h1>Thanks — your key is ready</h1>
<p>${quantity.toLocaleString()} calls credited to <strong>${email || "you"}</strong>.</p>
<div class="warn"><strong>Copy this now.</strong> It won't be shown again. If you lose it, email the founder and reference your Stripe receipt to get a replacement.</div>
<div class="key">${apiKey}</div>
<h2>How to use it</h2>
<pre>curl -X POST https://cron-explainer.cron-explainer-prod.workers.dev/v1/explain \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{"cron":"*/15 * * * *","tz":"Europe/Lisbon","n":3}'</pre>
<p>Balance endpoint: <code>GET /v1/balance</code> (send the same <code>x-api-key</code> header).</p>
<p><a href="/">Back to home</a></p>
</body></html>`;
}

export async function handleCheckoutSuccess(
  request: Request,
  env: Env
): Promise<Response> {
  const kv = env.KEYS;
  if (!kv) return html("<h1>Configuration error</h1><p>KEYS KV binding missing.</p>", 503);
  if (!env.STRIPE_SECRET_KEY) {
    return html("<h1>Configuration error</h1><p>Stripe secret missing.</p>", 503);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return html(
      "<h1>Missing session_id</h1><p>Return to the checkout flow and try again.</p>",
      400
    );
  }

  // Idempotency: if we already minted a key for this session, show it again.
  const existing = await getKeyForSession(kv, sessionId);
  if (existing) {
    const rec = await getKeyRecord(kv, existing);
    if (rec) {
      return html(successPage(existing, rec.total_purchased_cents, rec.email));
    }
  }

  let session;
  try {
    session = await retrieveCheckoutSession(env, sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return html(`<h1>Could not verify payment</h1><pre>${msg}</pre>`, 502);
  }

  if (session.payment_status !== "paid") {
    return html(
      `<h1>Payment not confirmed yet</h1><p>Status: <code>${session.payment_status}</code>. Refresh in a few seconds, or email the founder if this persists.</p>`,
      402
    );
  }

  const amountCents = Number(session.amount_total ?? 0);
  const email = session.customer_details?.email ?? "";
  const metaCalls = Number(session.metadata?.calls ?? 0);
  // Prefer metadata (authoritative from our checkout handler). Fall back to amount_total / 1¢.
  const calls = metaCalls > 0 ? metaCalls : amountCents;
  if (calls <= 0) {
    return html("<h1>Payment confirmed but no quantity resolved</h1><p>Email the founder with your Stripe receipt.</p>", 500);
  }

  const apiKey = generateApiKey("live");
  const now = new Date().toISOString();
  const rec: KeyRecord = {
    email,
    balance_cents: calls, // 1 call = 1 cent of balance
    total_purchased_cents: calls,
    created_at: now,
    session_id: sessionId,
    version: 1,
  };
  await putKeyRecord(kv, apiKey, rec);
  await bindSessionToKey(kv, sessionId, apiKey);

  return html(successPage(apiKey, calls, email));
}
