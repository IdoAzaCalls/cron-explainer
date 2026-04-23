import type { Env } from "../worker";
import { withBilling } from "../middleware/billing";
import { handleExplain } from "./explain";

/**
 * MCP Streamable HTTP server — JSON-RPC 2.0 over POST /mcp.
 *
 * This is the *protocol* endpoint required by the official MCP registry
 * (registry.modelcontextprotocol.io). It is distinct from the static
 * manifest served at /.well-known/mcp.json (which is AICo's own format).
 *
 * Supported methods:
 *   initialize                 → handshake, advertise capabilities
 *   tools/list                 → enumerate tools (just `explain_cron`)
 *   tools/call                 → invoke a tool (goes through withBilling)
 *   notifications/initialized  → client ack; return 202 no body
 *   ping                       → keepalive; return empty result
 *
 * Auth: the client passes `x-api-key` on the HTTP request to /mcp. We
 * forward it into an internal Request aimed at /v1/explain so that
 * withBilling performs the exact same balance check, decrement, and
 * refund-on-error semantics as the REST path.
 *
 * Transport scope: minimal Streamable HTTP — JSON responses only; no
 * SSE streams, no server-initiated requests, no resumption. This is
 * sufficient for stateless, one-shot tool calls.
 *
 * Legal: no uptime/accuracy over-claims; "best-effort" language only.
 */

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_NAME = "cron-explainer";
const SERVER_VERSION = "0.1.2";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcError {
  const err: JsonRpcError = { jsonrpc: "2.0", id, error: { code, message } };
  if (data !== undefined) err.error.data = data;
  return err;
}

function rpcOk(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const EXPLAIN_CRON_TOOL = {
  name: "explain_cron",
  description:
    "Parse a POSIX/Vixie cron expression and return the next N fire times plus an English description. Timezone-aware (IANA). Best-effort accuracy. Billed at 1 EUR cent per successful call; non-2xx responses are refunded.",
  inputSchema: {
    type: "object",
    required: ["cron"],
    properties: {
      cron: {
        type: "string",
        minLength: 1,
        description: "POSIX/Vixie cron expression (5 fields, e.g. '*/15 * * * *').",
      },
      tz: {
        type: "string",
        description: "IANA timezone (e.g. 'Europe/Lisbon'). Defaults to UTC.",
      },
      n: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 5,
        description: "Number of upcoming fire times to return.",
      },
    },
    additionalProperties: false,
  },
} as const;

async function handleInitialize(id: JsonRpcId): Promise<JsonRpcSuccess> {
  return rpcOk(id, {
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    capabilities: {
      tools: { listChanged: false },
    },
    instructions:
      "Use tool `explain_cron` to describe cron expressions and compute upcoming fire times. Provide x-api-key via the HTTP transport; buy keys at https://cron-explainer.cron-explainer-prod.workers.dev/.",
  });
}

async function handleToolsList(id: JsonRpcId): Promise<JsonRpcSuccess> {
  return rpcOk(id, { tools: [EXPLAIN_CRON_TOOL] });
}

async function handleToolsCall(
  id: JsonRpcId,
  params: Record<string, unknown> | undefined,
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<JsonRpcSuccess | JsonRpcError> {
  const name = typeof params?.name === "string" ? (params.name as string) : "";
  const args = (params?.arguments ?? {}) as Record<string, unknown>;

  if (name !== EXPLAIN_CRON_TOOL.name) {
    return rpcError(id, -32602, `unknown_tool: ${name}`);
  }

  // Build an internal Request targeting /v1/explain and forward the
  // x-api-key from the outer MCP request so billing applies uniformly.
  const baseUrl = env.BASE_URL ?? new URL(request.url).origin;
  const innerHeaders = new Headers({ "content-type": "application/json" });
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) innerHeaders.set("x-api-key", apiKey);

  const inner = new Request(`${baseUrl}/v1/explain`, {
    method: "POST",
    headers: innerHeaders,
    body: JSON.stringify(args),
  });

  const res = await withBilling(inner, env, ctx, (req) => handleExplain(req, env));
  const bodyText = await res.text();

  // Parse so we can re-emit as JSON content. If parse fails (shouldn't
  // happen for this handler, but defensive), fall through to text.
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = bodyText;
  }

  const isError = res.status < 200 || res.status >= 300;

  return rpcOk(id, {
    content: [
      {
        type: "text",
        text: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
      },
    ],
    isError,
  });
}

/**
 * POST /mcp — JSON-RPC 2.0 entrypoint.
 *
 * Accepts a single JSON-RPC object (batching is NOT supported in the
 * 2025-06-18 Streamable HTTP revision).
 */
export async function handleMcpServer(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== "POST") {
    // Minimal transport — no GET/SSE.
    return new Response("method_not_allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  let body: JsonRpcRequest;
  try {
    const raw = await request.text();
    if (!raw) return jsonResponse(rpcError(null, -32700, "parse_error: empty body"), 400);
    body = JSON.parse(raw) as JsonRpcRequest;
  } catch {
    return jsonResponse(rpcError(null, -32700, "parse_error"), 400);
  }

  if (body?.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return jsonResponse(
      rpcError(body?.id ?? null, -32600, "invalid_request"),
      400
    );
  }

  const id: JsonRpcId = body.id ?? null;
  const method = body.method;
  const isNotification = body.id === undefined;

  // Notifications: no response body, just 202.
  if (isNotification) {
    return new Response(null, { status: 202 });
  }

  try {
    switch (method) {
      case "initialize":
        return jsonResponse(await handleInitialize(id));
      case "tools/list":
        return jsonResponse(await handleToolsList(id));
      case "tools/call":
        return jsonResponse(await handleToolsCall(id, body.params, request, env, ctx));
      case "ping":
        return jsonResponse(rpcOk(id, {}));
      default:
        return jsonResponse(rpcError(id, -32601, `method_not_found: ${method}`));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal_error";
    return jsonResponse(rpcError(id, -32603, `internal_error: ${msg}`), 500);
  }
}
