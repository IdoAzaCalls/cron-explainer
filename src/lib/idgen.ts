/**
 * API key generation.
 *
 * Format: `cronx_live_<43 base64url chars>` — 32 bytes of entropy.
 * Prefix makes the env (live/test) and service obvious to operators.
 */

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  const b64 = btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateApiKey(envTag: "live" | "test" = "live"): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `cronx_${envTag}_${toBase64Url(bytes)}`;
}
