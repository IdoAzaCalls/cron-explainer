import type { Env } from "../worker";

const SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://cron-explainer.example/v1/schema",
  title: "CronExplainer",
  type: "object",
  definitions: {
    Input: {
      type: "object",
      required: ["cron"],
      properties: {
        cron: { type: "string", minLength: 1, description: "POSIX/Vixie cron expression (5 fields)." },
        tz: { type: "string", description: "IANA timezone (e.g. Europe/Lisbon). Defaults to UTC." },
        n: { type: "integer", minimum: 1, maximum: 100, default: 5 },
      },
      additionalProperties: false,
    },
    Output: {
      type: "object",
      required: ["valid", "input", "errors"],
      properties: {
        valid: { type: "boolean" },
        input: { $ref: "#/definitions/Input" },
        description: { type: "string", description: "Best-effort English description." },
        next: {
          type: "array",
          items: { type: "string", format: "date-time" },
          description: "ISO-8601 timestamps of the next N fire times.",
        },
        flags: {
          type: "object",
          properties: {
            dst_transition_ahead: { type: "boolean" },
            ambiguous: { type: "boolean" },
            notes: { type: "array", items: { type: "string" } },
          },
        },
        errors: { type: "array", items: { type: "string" } },
      },
    },
  },
};

export async function handleSchema(_env: Env): Promise<Response> {
  return new Response(JSON.stringify(SCHEMA), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
