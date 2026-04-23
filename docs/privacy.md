# Privacy Notice — cron-explainer API

**Effective date:** 2026-04-23
**Controller:** Ido Azaria, Portugal (for billing / account data).
**Role for API inputs:** Processor on behalf of the caller (you).

## 1. What we process

### 1.1 API inputs (`/v1/explain` request bodies)
- A cron expression string (`cron`), an IANA timezone name (`tz`), and an integer (`n`).
- The input grammar does not require, expect, or meaningfully support personal data. The service is designed and documented for non-PII inputs only.
- Request and response bodies are **not logged** and **not retained** beyond the lifetime of the HTTP request.

### 1.2 Request metadata (logged; retained ≤ 30 days)
- `request_id`, HTTP method, path, status code, latency, byte count, Stripe ACP `caller_id` (when billing is enabled), timestamp, IP-derived coarse region (if any).
- These are used solely for operations, abuse prevention, and billing reconciliation.

### 1.3 Billing data
- Collected and processed by Stripe under Stripe's own privacy policy. We do not store raw card or bank details.

## 2. Legal bases (GDPR Art. 6)
- Contract (Art. 6(1)(b)) — provision of the paid service you requested.
- Legitimate interest (Art. 6(1)(f)) — security, abuse prevention, and service metrics.
- Legal obligation (Art. 6(1)(c)) — tax and accounting records.

## 3. Transfers
- Hosted on Cloudflare Workers (global edge). Cloudflare is our subprocessor.
- Stripe is our payment subprocessor.
- A subprocessor list is available on request.

## 4. Your rights (GDPR / Portuguese law)
- Access, rectification, erasure, restriction, objection, portability.
- Right to lodge a complaint with the Portuguese supervisory authority (CNPD — Comissão Nacional de Proteção de Dados).

Contact: azariaido@gmail.com.

## 5. Data Processing Agreement (DPA)
If you are a controller passing personal data to the service and you need a processor DPA under GDPR Art. 28, please note: the service is **not** intended to process personal data, and using it to do so is a breach of these terms. If you still require a DPA for your own audit purposes, contact us at the address above.

## 6. Changes
We may update this notice by publishing a new version at `/legal/privacy` with a new effective date.
