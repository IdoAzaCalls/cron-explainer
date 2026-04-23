import type { Env } from "../worker";

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleLanding(_request: Request, _env: Env): Promise<Response> {
  const body = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>cron-explainer — pay-per-call cron parser</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:720px;margin:3rem auto;padding:0 1rem;color:#111;line-height:1.55}
  h1{font-size:2rem;margin-bottom:0}
  .tag{color:#555;margin-top:.2rem}
  code{background:#f3f3f3;padding:.15rem .4rem;border-radius:4px}
  pre{background:#111;color:#eee;padding:1rem;border-radius:8px;overflow-x:auto;font-size:.9rem}
  .cta{display:inline-block;background:#0a7;color:#fff;padding:.75rem 1.25rem;border-radius:8px;font-weight:600;text-decoration:none;margin-right:.5rem}
  .cta.secondary{background:#333}
  .muted{color:#777;font-size:.9em}
  table{border-collapse:collapse}
  td,th{padding:.35rem .75rem;border-bottom:1px solid #eee;text-align:left}
</style></head><body>
<h1>cron-explainer</h1>
<p class="tag">Best-effort cron expression parser. Returns the next N fire times plus a plain-English description. Timezone-aware. Zero PII.</p>

<h2>Pricing</h2>
<table>
<tr><th>Package</th><th>Price</th><th>Per call</th></tr>
<tr><td>500 calls</td><td>€5</td><td>€0.01</td></tr>
<tr><td>5,000 calls</td><td>€50</td><td>€0.01</td></tr>
<tr><td>50,000 calls</td><td>€500</td><td>€0.01</td></tr>
</table>
<p class="muted">Billed once via Stripe. No subscription. Calls never expire. Need more or a custom arrangement? Email <a href="mailto:azariaido@gmail.com">azariaido@gmail.com</a>.</p>

<p>
  <a class="cta" href="#" onclick="buy(500);return false;">Buy 500 calls — €5</a>
  <a class="cta" href="#" onclick="buy(5000);return false;">Buy 5,000 — €50</a>
  <a class="cta secondary" href="#" onclick="buy(50000);return false;">Buy 50,000 — €500</a>
</p>

<h2>Try it (the first 10 calls are on us — coming soon)</h2>
<pre>curl -X POST https://cron-explainer.cron-explainer-prod.workers.dev/v1/explain \\
  -H "content-type: application/json" \\
  -H "x-api-key: &lt;your-key&gt;" \\
  -d '{"cron":"*/15 * * * *","tz":"Europe/Lisbon","n":3}'</pre>

<h2>Endpoints</h2>
<ul>
  <li><code>POST /v1/explain</code> — parse a cron, get description + next N fires. Charged.</li>
  <li><code>GET /v1/balance</code> — remaining balance for your key. Free.</li>
  <li><code>GET /v1/schema</code> — input/output JSON schema. Free.</li>
  <li><code>GET /.well-known/mcp.json</code> — MCP tool manifest. Free.</li>
  <li><code>GET /health</code> — liveness. Free.</li>
</ul>

<h2>Legal</h2>
<p><a href="/legal/tos">Terms</a> · <a href="/legal/privacy">Privacy</a> · <a href="/legal/disclaimer">Disclaimer</a> · <a href="/legal/notices">OSS notices</a></p>

<p class="muted">Operated by AICo (human of record: Ido Azaria, Portugal). Best-effort accuracy; no warranty. Not for safety-critical scheduling.</p>

<script>
async function buy(q){
  const res = await fetch('/v1/checkout', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({quantity:q})});
  const j = await res.json();
  if (j.url) window.location = j.url;
  else alert('Checkout error: ' + (j.detail || j.error || 'unknown'));
}
</script>
</body></html>`;
  return html(body);
}

export async function handleCheckoutCancel(): Promise<Response> {
  return new Response(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:640px;margin:3rem auto;padding:0 1rem">
<h1>Checkout cancelled</h1><p>No charge was made. <a href="/">Back to home</a>.</p>
</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function handleBalance(request: Request, env: Env): Promise<Response> {
  const kv = env.KEYS;
  if (!kv) return new Response(JSON.stringify({ error: "kv_missing" }), { status: 503 });
  const apiKey = request.headers.get("x-api-key") ?? "";
  if (!apiKey) return new Response(JSON.stringify({ error: "auth_required" }), { status: 401 });
  const { getKeyRecord } = await import("../lib/keystore");
  const rec = await getKeyRecord(kv, apiKey);
  if (!rec) return new Response(JSON.stringify({ error: "invalid_key" }), { status: 401 });
  return new Response(
    JSON.stringify({
      balance_cents: rec.balance_cents,
      total_purchased_cents: rec.total_purchased_cents,
      created_at: rec.created_at,
      last_used_at: rec.last_used_at ?? null,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
