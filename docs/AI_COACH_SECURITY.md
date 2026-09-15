# AI Coach security and privacy review

Reviewed September 13, 2026 for the initial external-agent weekly-review release.

## Boundary and data flow

Workout logging is local-first and independent of Coach. Explicit coaching plus workout-history consent is required before a bounded, versioned context can be created. That context contains goals, aggregate metrics, at most 24 detailed workouts, opted-in check-ins, the latest feedback decision, and truncation/coverage disclosures. User-entered text is labeled untrusted. No free-form chat transcript is stored.

The preferred developer workflow connects a trusted agent through the hosted Supabase MCP server, scoped to this project and authenticated with Supabase OAuth. MCP supplies the live schema and database tools, so WorkoutPal no longer asks users to copy a custom agent token. This is developer/admin access rather than an individual WorkoutPal user's RLS-scoped session; use the read-only MCP URL unless writes are required.

The deployed `coaching-agent` Edge Function and its hashed, revocable credentials remain temporarily for backward compatibility. The app no longer creates or shares those credentials. Remove the legacy function and tables only after confirming that no runner still uses them and applying an explicit migration.

## Threats and controls

| Threat | Control | Residual risk / response |
| --- | --- | --- |
| Broad MCP permissions | Project-scoped URL, Supabase OAuth, optional `read_only=true`, trusted-agent-only copy | Full MCP access can inspect or change data beyond one WorkoutPal user. Prefer read-only, use a development project for experimentation, and review writes. |
| Token disclosure | 256-bit token, hash-only storage, no-store responses, explicit rotation/revocation | A holder can act as Coach until rotation, revocation, or consent removal. Keep the token in a secret store, never a prompt or log. |
| Cross-user access | Token resolves to one owner; every request/review query includes that owner; RLS isolates app reads/writes | Service-role code is high impact. Keep the function small and rerun two-user endpoint/RLS tests after changes. |
| Consent revocation | Every endpoint call checks the newest synced profile; disabled coaching or history sharing returns 403 | Offline revocation reaches the server on the next sync. Revoke the agent token immediately if access must stop before connectivity returns. |
| Prompt injection in goals, notes, or exercise names | Context marks user text untrusted; starter instruction repeats the boundary; output is data-only and whole-payload validated | A model may still produce poor prose; the validator prevents extra actions/fields and evidence outside context, not every semantic error. |
| Fabricated or stale claims | Exact generation key, period, latest workout, source fields, bounded evidence allowlist, duplicate-ID rejection, confidence and limitations | A correction after generation marks an older review superseded in the app. |
| Oversized/malformed output | 100 KB request cap, strict field allowlists, length/enum/date/array validation, database JSON constraints | Validation logic exists at both app and Edge boundaries; contract changes must update and test both. |
| Replay/duplicate execution | Unique owner/generation key, atomic-ish pending claim, stale-claim recovery, idempotent publish | A runner can hold a claim for 15 minutes; the UI exposes delay/failure and manual retry. |
| Excessive client mutation | RLS ownership checks and column-level grant restrict request retry fields | An authenticated owner can manipulate their own retry state; they cannot change another owner or the immutable generation context. |
| Retention/deletion | In-app deletion clears local coaching records immediately and queues an owner-scoped, RLS-enforced server purge; account deletion also cascades | Offline deletion remains queued until authenticated sync. The UI states that workouts/routines are retained. |

## Auditability and rollout checks

Credential creation/update/revocation/last use are timestamped. Generation requests retain requested/update times, status, attempts, retry time, bounded failure text, generation key, and resulting review ID. Published reviews are immutable except for local archive state and retain the exact profile revision and context generation key.

Before rollout: run typecheck/unit tests/iOS export, deploy the function, exercise invalid token, revoked token, revoked consent, cross-user isolation, invalid fields/evidence, retry, valid publish, and duplicate publish; run all database ownership tests and security advisors. Do not log tokens or full coaching contexts during these checks.
