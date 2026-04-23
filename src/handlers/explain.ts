import type { Env } from "../worker";
import { parseAndRun, type ExplainResult } from "../lib/cron";

interface ExplainInput {
  cron?: string;
  tz?: string;
  n?: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleExplain(request: Request, env: Env): Promise<Response> {
  let input: ExplainInput;
  try {
    const raw = await request.text();
    if (!raw) return json({ valid: false, errors: ["empty_body"] }, 400);
    input = JSON.parse(raw) as ExplainInput;
  } catch {
    return json({ valid: false, errors: ["invalid_json"] }, 400);
  }

  const cron = typeof input.cron === "string" ? input.cron.trim() : "";
  const tz = typeof input.tz === "string" && input.tz.length > 0 ? input.tz : env.DEFAULT_TZ ?? "UTC";
  const maxN = Number(env.MAX_N ?? "100");
  const requestedN = typeof input.n === "number" ? input.n : 5;
  const n = Math.max(1, Math.min(maxN, Math.floor(requestedN)));

  if (!cron) {
    return json({ valid: false, input: { cron, tz, n }, errors: ["cron_required"] }, 400);
  }

  const result: ExplainResult = parseAndRun(cron, tz, n);
  const status = result.valid ? 200 : 400;
  return json({ input: { cron, tz, n }, ...result }, status);
}
