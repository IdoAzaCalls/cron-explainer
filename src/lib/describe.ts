/**
 * Placeholder for a future deterministic cron-to-English formatter that does
 * not depend on cronstrue. cronstrue is used in lib/cron.ts for v1.
 *
 * Keep this file for when we want offline, fully-deterministic, auditable
 * description output without a third-party dep.
 */

export function fallbackDescribe(cron: string): string {
  const fields = cron.trim().split(/\s+/);
  if (fields.length < 5) return "Invalid cron expression: fewer than 5 fields.";
  return `Cron expression with ${fields.length} fields (no-dependency fallback description).`;
}
