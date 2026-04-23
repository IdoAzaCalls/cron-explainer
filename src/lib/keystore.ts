/**
 * KV-backed API key + balance store.
 *
 * Layout:
 *   key:<api_key>             → KeyRecord (JSON)
 *   session:<checkout_id>     → api_key (string) — idempotency guard for
 *                               /v1/checkout/success refreshes
 *
 * KV is eventually consistent. Concurrent `/v1/explain` calls from one caller
 * may race on decrement; at 1-cent unit this is acceptable operational loss.
 * Move to D1 or Durable Objects in v0.2 if the loss rate matters.
 */

export interface KeyRecord {
  email: string;
  balance_cents: number;
  total_purchased_cents: number;
  created_at: string; // ISO
  session_id: string;
  last_used_at?: string; // ISO
  version: 1;
}

const KEY_PREFIX = "key:";
const SESSION_PREFIX = "session:";

export async function getKeyRecord(
  kv: KVNamespace,
  apiKey: string
): Promise<KeyRecord | null> {
  return (await kv.get<KeyRecord>(KEY_PREFIX + apiKey, "json")) as KeyRecord | null;
}

export async function putKeyRecord(
  kv: KVNamespace,
  apiKey: string,
  rec: KeyRecord
): Promise<void> {
  await kv.put(KEY_PREFIX + apiKey, JSON.stringify(rec));
}

/**
 * Best-effort atomic-ish decrement. Returns the updated record, or null if
 * the key does not exist, or the string "insufficient" if the balance is
 * below the requested amount.
 */
export async function decrementBalance(
  kv: KVNamespace,
  apiKey: string,
  amount: number
): Promise<KeyRecord | "insufficient" | null> {
  const rec = await getKeyRecord(kv, apiKey);
  if (!rec) return null;
  if (rec.balance_cents < amount) return "insufficient";
  const updated: KeyRecord = {
    ...rec,
    balance_cents: rec.balance_cents - amount,
    last_used_at: new Date().toISOString(),
  };
  await putKeyRecord(kv, apiKey, updated);
  return updated;
}

export async function refundBalance(
  kv: KVNamespace,
  apiKey: string,
  amount: number
): Promise<void> {
  const rec = await getKeyRecord(kv, apiKey);
  if (!rec) return;
  const updated: KeyRecord = {
    ...rec,
    balance_cents: rec.balance_cents + amount,
  };
  await putKeyRecord(kv, apiKey, updated);
}

export async function getKeyForSession(
  kv: KVNamespace,
  sessionId: string
): Promise<string | null> {
  return await kv.get(SESSION_PREFIX + sessionId);
}

export async function bindSessionToKey(
  kv: KVNamespace,
  sessionId: string,
  apiKey: string
): Promise<void> {
  await kv.put(SESSION_PREFIX + sessionId, apiKey);
}
