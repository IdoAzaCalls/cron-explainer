# Pricing — cron-explainer API

| Item | Price | Notes |
|---|---|---|
| `/v1/explain` success (200) | EUR 0.01 / call | Billed via Stripe ACP |
| `/v1/explain` error (4xx/5xx) | free | No charge on invalid input or service error |
| `/health`, `/v1/schema`, `/.well-known/mcp.json` | free | Unauthenticated metadata endpoints |

**VAT / tax.** Prices above are net. Portuguese VAT, EU OSS VAT, and other applicable taxes are added at checkout by Stripe Tax. Valid EU B2B VAT IDs qualify for the reverse-charge mechanism.

**Payment method.** Stripe Agentic Commerce (ACP) is the supported method. Classic Stripe Checkout may be offered for human buyers post-MVP.

**Soft rate limit.** 120 calls/minute/caller. Returns HTTP 429 when exceeded. Lift by contacting support.

**Changes.** Price and limit changes are announced at least 30 days in advance by updating the MCP manifest at `/.well-known/mcp.json` and this page.
