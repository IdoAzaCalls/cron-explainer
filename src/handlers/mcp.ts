import type { Env } from "../worker";

/**
 * Static tool manifest served at /.well-known/mcp.json.
 *
 * NOTE: This is AICo's custom manifest format — NOT the official MCP
 * registry (registry.modelcontextprotocol.io) server.json schema. It
 * advertises the `/v1/explain` REST tool for machine consumers. Full
 * MCP-protocol compliance (Streamable HTTP /mcp endpoint + server.json
 * + mcp-publisher) is deferred — see task "Full MCP registry listing".
 *
 * Legal: no uptime/accuracy over-claims; "best-effort" language only.
 */
const MANIFEST = {
  name: "cron-explainer",
  version: "0.1.2",
  description:
    "Best-effort cron expression parser and explainer. Returns the next N fire times and a human-readable description. Zero PII; inputs are cron strings and IANA timezones only.",
  publisher: {
    name: "AICo",
    human_of_record: "Ido Azaria",
    country: "PT",
  },
  auth: {
    scheme: "api_key",
    header: "x-api-key",
    acquire: {
      method: "POST",
      path: "/v1/checkout",
      notes:
        "POST {quantity: 500|5000|50000} to /v1/checkout, follow returned Stripe Checkout URL, pay once. Key is minted at /v1/checkout/success and shown exactly once.",
    },
    balance_endpoint: {
      method: "GET",
      path: "/v1/balance",
      notes: "Send x-api-key header; returns remaining balance_cents.",
    },
  },
  tools: [
    {
      name: "explain_cron",
      description:
        "Parse a cron expression and return the next N fire times plus an English description. Best-effort accuracy using the croner parser. Timezone-aware (IANA).",
      endpoint: {
        method: "POST",
        path: "/v1/explain",
      },
      input_schema_ref: "/v1/schema#/definitions/Input",
      output_schema_ref: "/v1/schema#/definitions/Output",
      pricing: {
        model: "prepaid_per_call",
        unit_price_minor: 1,
        currency: "EUR",
        notes:
          "1 cent per successful call, prepaid in packs of 500/5000/50000. Non-2xx responses are refunded. VAT handled via Stripe Tax. No subscription; calls never expire.",
      },
      rate_limits: {
        per_caller_per_minute: 120,
        notes: "Soft limit. Exceeding returns 429. No hard monthly cap in v1.",
      },
    },
  ],
  compliance: {
    pii: "none",
    data_retention: "no_payload_retention",
    logs: "metadata_only (request_id, status, latency_ms, byte_count, caller_id, timestamp)",
    oss_notices: "/legal/notices",
    tos: "/legal/tos",
    privacy: "/legal/privacy",
    disclaimer: "/legal/disclaimer",
  },
};

export async function handleMcp(_env: Env): Promise<Response> {
  return new Response(JSON.stringify(MANIFEST), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
