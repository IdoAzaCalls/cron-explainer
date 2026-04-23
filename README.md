# cron-explainer

A tiny pay-per-call API that parses cron expressions, returns the next N fire
times, and produces a short English description. Timezone-aware (IANA).

**Live:** https://cron-explainer.cron-explainer-prod.workers.dev/
**Pricing:** 0.01 EUR per successful call, prepaid via Stripe Checkout in packs of 500 / 5,000 / 50,000 calls. Non-2xx responses are refunded. No subscription. Keys never expire.

## Quick start

1. Get a key at https://cron-explainer.cron-explainer-prod.workers.dev/ (Stripe Checkout, €5 minimum).
2. Copy the key — it's shown exactly once.
3. Call the API:

```bash
curl -X POST https://cron-explainer.cron-explainer-prod.workers.dev/v1/explain \
  -H "content-type: application/json" \
  -H "x-api-key: $YOUR_KEY" \
  -d '{"cron":"0 9 * * 1-5","tz":"Europe/Lisbon","n":3}'
```

Response:

```json
{
  "input": {"cron":"0 9 * * 1-5","tz":"Europe/Lisbon","n":3},
  "valid": true,
  "description": "At 09:00, Monday through Friday",
  "next": ["2026-04-24T08:00:00.000Z","2026-04-27T08:00:00.000Z","2026-04-28T08:00:00.000Z"],
  "flags": {"dst_transition_ahead": false, "ambiguous": false, "notes": []},
  "errors": []
}
```

Check remaining balance:

```bash
curl -H "x-api-key: $YOUR_KEY" \
  https://cron-explainer.cron-explainer-prod.workers.dev/v1/balance
```

## MCP

The server is listed on the official MCP registry as
`io.github.IdoAzaCalls/cron-explainer` with a Streamable HTTP endpoint at
`POST /mcp`. It exposes one tool, `explain_cron`. Pass your `x-api-key` as
an HTTP header on the MCP transport; billing is identical to the REST path.

Registry entry: https://registry.modelcontextprotocol.io/v0/servers?search=cron-explainer

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/explain` | Parse + describe + next fire times (billed) |
| `GET`  | `/v1/balance` | Remaining balance for an `x-api-key` |
| `POST` | `/v1/checkout` | Create a Stripe Checkout Session |
| `GET`  | `/v1/schema` | JSON Schema for request/response |
| `POST` | `/mcp` | MCP Streamable HTTP (JSON-RPC 2.0) |
| `GET`  | `/.well-known/mcp.json` | Static tool manifest |
| `GET`  | `/health` | Liveness probe |
| `GET`  | `/legal/{tos,privacy,disclaimer,notices}` | Legal docs |

## Limits

- Cron: 5-field POSIX/Vixie syntax (minute, hour, day-of-month, month, day-of-week).
- Timezones: IANA names (e.g. `Europe/Lisbon`, `America/Los_Angeles`). Defaults to `UTC`.
- `n` clamps to `[1, 100]`.
- Best-effort accuracy. See `/legal/disclaimer` for warranty terms.
- Zero PII: inputs are cron strings and IANA timezones only. Request and response bodies are never logged.

## Stack

TypeScript on Cloudflare Workers. Cron parsing via
[`croner`](https://github.com/Hexagon/croner) (MIT). English descriptions via
[`cronstrue`](https://github.com/bradymholt/cRonstrue) (MIT). Full NOTICE
text at [`/legal/notices`](https://cron-explainer.cron-explainer-prod.workers.dev/legal/notices).

## Contact

azariaido@gmail.com — billing issues, bug reports, custom pricing.
