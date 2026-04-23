# Terms of Service — cron-explainer API

**Effective date:** 2026-04-23
**Service provider:** Ido Azaria (sole trader / ENI), Portugal. Human-of-record for AICo.
**Contact:** azariaido@gmail.com

## 1. Service
cron-explainer is a pay-per-call HTTP API that parses a cron expression and returns the next N fire times and a best-effort human-readable description. Calls are paid for with prepaid API keys purchased via Stripe Checkout in fixed packs (500, 5,000, or 50,000 calls).

## 2. Acceptable use
- You may call the API programmatically. Automated callers, including autonomous software agents, are welcome.
- You must not send personal data (PII) in the `cron` or `tz` fields. The input grammar does not require PII and the service will not sanitize accidental inclusion.
- You must not use the service to facilitate illegal activity, infringe third-party rights, or attempt to disrupt the service (DDoS, credential stuffing, etc.).

## 3. Billing
- Unit price: EUR 0.01 per successful call (status 200 on `/v1/explain`). Non-2xx responses are refunded to the paying key's balance.
- Prepaid model only. Keys never expire. No subscription.
- VAT/GST is handled via Stripe Tax at the applicable jurisdictional rate. B2B EU customers providing a valid VAT ID are invoiced under the reverse-charge mechanism.
- Prices may change with 30 days' notice via the landing page and `/.well-known/mcp.json` manifest. Already-purchased balance is honored at the price in effect at purchase.

## 4. No warranty; limitation of liability
- The service is provided on an **"as is" and "as available" best-effort basis**. We make no representation of uptime, accuracy, fitness for a particular purpose, or non-infringement.
- We are not liable for consequential, incidental, special, or indirect damages. Aggregate liability is capped at the amount you paid in the 30 days preceding the claim.

## 5. Privacy & data handling
- See the Privacy Notice at `/legal/privacy`.
- Zero payload retention. Logs store only metadata (request id, status, latency, byte count, caller id, timestamp).

## 6. Suspension
We may suspend or terminate access to any caller that violates these terms or abuses the service, with or without notice.

## 7. Governing law
These terms are governed by the laws of Portugal. Disputes are subject to the exclusive jurisdiction of the courts of the Judicial District of Lisbon, without prejudice to mandatory consumer-protection rules where applicable.

## 8. Changes
We may update these terms by publishing a new version at `/legal/tos` with a new effective date. Continued use after the effective date constitutes acceptance.
