# AI Coach feature Kanban

Updated: September 13, 2026. Branch: `feature/ai-coach`.

This is the detailed source of truth for AI Coach work. The global [KANBAN.md](KANBAN.md) retains the feature-level priority and links here. Work one task at a time. Before stopping, overwrite the Handoff with current state, decisions, validation, blockers, and the exact next action.

## Product boundary

- External-agent-driven for the initial personal release.
- Weekly reviews are the primary rhythm and support long-term motivation.
- WorkoutPal remains fully usable offline; generating a new review may require connectivity.
- SQLite remains the immediate app source of truth.
- Agents may publish validated reviews and, in a later milestone, pending routine proposals. They never modify history or adopt their own proposal.
- No implementation work is authorized outside the tasks on this board.

## Handoff

- Current: AIC-012 is complete; AIC-016 weekly scheduling is in progress as the next eligible task. AIC-006/AIC-011 await physical-iPhone verification. AIC-013–AIC-015 remain dependency-gated by WP-013–WP-015. Unrelated QA-004 working-tree changes remain preserved and separate.
- Changes: Added local-first usefulness/tone/changed-constraint feedback, review UI controls, cloud sync/RLS, and next-context inclusion. Routine, check-in, and feedback changes now alter the context generation fingerprint to prevent stale regeneration.
- Decisions: Goal priority controls conflicts; constraints and avoided exercises outrank preferences; current explicit input outranks older/inferred context. Goal edits create revisions, and earlier reviews retain the revision they analyzed. Coaching requires explicit workout-history consent; notification consent remains separate.
- Validation: AIC-012 passes typecheck, 43/43 tests, iOS export, migration parity, remote two-user RLS tests, security advisors, and diff check.
- Blockers: AIC-013/AIC-015 wait on the routine target tasks WP-013–WP-015. AIC-006/AIC-011 device verification is pending; none blocks AIC-016.
- Exact next action: Implement automatic preferred-day scheduling, duplicate prevention, notification opt-in, delayed/offline behavior, and lifecycle checks without blocking workout logging.

## Ready

None.

## In progress

- **AIC-016 Weekly scheduling:** Implement preferred review day/timezone, opt-in notification, duplicate prevention, delayed/offline behavior, retries, and failure visibility; after AIC-010.

## Verify

- **AIC-006 Goal UI:** Build accessible My Goals and coaching-consent UI with minimal required inputs; after AIC-004. Implementation/typecheck/tests/export pass; verify VoiceOver, large text, keyboard flow, offline save/restart, and consent copy on the physical iPhone.
- **AIC-011 Review UI:** Add Coach card, structured weekly review detail, evidence links, confidence/limitations/context visibility, archive, loading/delayed/failure states, and offline reading; after AIC-009. Implementation/typecheck/tests/export pass; verify navigation, state transitions, evidence links, VoiceOver, large text, and offline archive on the physical iPhone.

## Blocked

None.

## Backlog

- **AIC-013 Routine proposal contract:** Define supported routine fields, per-change rationale, safety constraints, source routine version, conflict detection, and invalid-output cases; after WP-013.
- **AIC-014 Proposal persistence and sync:** Store pending/accepted/dismissed proposals with immutable source data, RLS, idempotency, and offline availability; after AIC-013 and AIC-009.
- **AIC-015 Proposal comparison and adoption:** Show before/after changes and accept/edit/dismiss. Preserve the prior routine, never change an active workout, and prevent duplicate or stale application; after AIC-014 and WP-015.
- **AIC-017 Security and privacy review:** Threat-model agent credentials, prompt injection from stored text, data minimization, consent, retention/deletion, external context, auditability, and cross-user access. Run advisors and all ownership tests before rollout.
- **AIC-018 End-to-end QA:** Validate offline logging independence, sync recovery, corrected/deleted history, sparse weeks, week/DST boundaries, duplicate runs, invalid agent output, stale routines, accessibility, and physical-iPhone behavior.

## Done

- **AIC-012 Coaching feedback:** Added local-first usefulness/tone/constraint feedback, review controls, cloud sync/RLS, and next-context generation-key binding. Evidence: typecheck, 43/43 tests, iOS export, migration parity, remote RLS/advisors, and diff check on September 13, 2026.
- **AIC-010 External agent workflow:** Added synced generation requests, revocable hashed narrow tokens, deployed agent endpoint, retry/failure/idempotency behavior, strict generation/evidence publishing, setup UI, and operational guidance. Evidence: live isolated endpoint journey, active Function v2, remote RLS/advisors, migration parity, typecheck, 40/40 tests, iOS export, and diff check on September 13, 2026.
- **AIC-009 Review persistence:** Added immutable local/cloud review records, context/evidence validation, stable generation idempotency, superseded detection, offline outbox/archive, schema checks, explicit grants, RLS, and validated pull/merge. Evidence: typecheck, 38/38 tests, diff check, remote migration and two-user RLS pass, and no new security-advisor findings on September 13, 2026.
- **AIC-008 Coaching context v1:** Added a consent-gated, provider-neutral, bounded context with goal/routine versions, deterministic metrics, detailed evidence, check-ins, prior-decision slot, truncation disclosure, trust labeling, and correction-sensitive generation keys. Evidence: typecheck, 35/35 tests, and diff check on September 13, 2026.
- **AIC-007 Weekly metrics:** Added DST-safe completed local weeks, completed-session/working-set metrics, per-exercise mixed-unit normalization, evidence IDs, coverage/comparability, latest workout, and deterministic review-kind selection. Evidence: typecheck, 32/32 tests, and diff check on September 13, 2026.
- **AIC-005 Goal cloud sync:** Added/applied explicit-grant profile/check-in tables, immutable revision and owner-scoped RLS policies, outbox push plus validated pull/merge, and two-user isolation tests. Repaired migration history first. Evidence: remote RLS pass, migration parity, no new-table advisor findings, typecheck, 29/29 tests, iOS export, and diff check on September 13, 2026.
- **AIC-004 Goal persistence:** Added offline-first SQLite profile revision/check-in storage, immutable sequential revisions, repository APIs, atomic outbox writes, owner attachment, safe defaults, and validation coverage. Evidence: typecheck, 29/29 tests, iOS export, and diff check pass on September 13, 2026.
- **AIC-001 Review contract v1:** Added provider-neutral output types, whole-payload validation, generation binding, evidence rules, continuity check-ins, invalid cases, and durable agent guidance. Evidence: typecheck, 14/14 tests, iOS export, and diff check pass on September 12, 2026.
- **AIC-002 Representative review fixtures:** Added five synthetic input/output journeys, executable contract/evidence-reference checks, minimum-data guidance, and a quality/repetition rubric. Evidence: typecheck, 20/20 tests, and diff check pass on September 12, 2026; no external model run claimed.
- **AIC-003 Goal model design:** Added validated v1 goal/profile types, ranked-goal semantics, constraints/preferences, weekly scheduling and consent rules, revision/correction guidance, and 7 goal-model tests. Evidence: typecheck, 27/27 tests, and diff check pass on September 12, 2026.

## Validation expectations

- Contract or calculation changes: `npm run typecheck`, `npm test`, fixtures, and `git diff --check`.
- Material app changes: also `npx expo export --platform ios` and relevant physical-iPhone checks.
- Database changes: explicit grants plus RLS, owner/cross-owner tests, and security advisors. Follow current Supabase documentation because Data API defaults and MCP capabilities change.
- Never claim an agent, scheduled review, migration, or E2E flow works until that exact path has been exercised.

## Working-tree ownership

- AIC-001 files: `src/coaching/contracts.ts`, `src/coaching/contracts.test.ts`, `docs/COACHING_AGENT_GUIDE.md`, and this feature board.
- AIC-002 files: `src/coaching/fixtures.ts`, `src/coaching/fixtures.test.ts`, and `docs/AI_COACH_REVIEW_EVALUATION.md`.
- AIC-003 files: `src/coaching/goals.ts`, `src/coaching/goals.test.ts`, and `docs/AI_COACH_GOAL_MODEL.md`.
- Shared files intentionally touched by AIC-001: the `test` script only in `package.json`, plus WP-032 handoff/lane text in `docs/KANBAN.md`.
- Earlier AI discovery work: `docs/AI_COACHING_PRD.md`.
- Pre-existing QA-004 work that must remain separate: `.gitignore`, `README.md`, `.detoxrc.js`, `e2e/`, `scripts/`, Detox/Jest dependency changes in `package.json` and `package-lock.json`, and selector edits in `app/(tabs)/index.tsx`, `app/workout.tsx`, and `src/components/ExercisePicker.tsx`.

## Key files

- Product requirements: `docs/AI_COACHING_PRD.md`
- Feature queue/handoff: `docs/AI_COACH_KANBAN.md`
- Agent contract guide: `docs/COACHING_AGENT_GUIDE.md`
- Runtime contracts: `src/coaching/contracts.ts`
- Local persistence: `src/data/database.ts`
- Cloud synchronization: `src/data/sync.ts`
- Remote schema/security: `supabase/migrations/`, `supabase/tests/rls.sql`
- App lifecycle: `src/context/AppContext.tsx`
