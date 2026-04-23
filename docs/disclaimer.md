# Accuracy & Warranty Disclaimer — cron-explainer API

The service returns **best-effort** cron parsing and description. Specifically:

- We use the open-source `croner` library (MIT) to compute next fire times and `cronstrue` (MIT) to generate English descriptions. These libraries have their own bugs and quirks; we do not guarantee their output.
- DST transitions, leap seconds, and ambiguous local times are surfaced via the `flags` field as best-effort indicators, not guarantees.
- We support 5-field POSIX/Vixie-style cron in v1. Quartz-style (6+ fields, with seconds and/or year) is detected and reported as unsupported.
- Callers are responsible for verifying the service's output before using it to schedule consequential actions (production jobs, billing runs, etc.).

No SLA is offered in v1. No claim of "GDPR-compliant," "SOC 2," "HIPAA-grade," "99.9% uptime," or similar is made.
