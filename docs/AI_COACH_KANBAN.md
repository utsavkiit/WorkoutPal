# AI Coach feature Kanban

Updated: September 12, 2026. Branch: `feature/ai-coach`.

This is the detailed source of truth for AI Coach work. The global [KANBAN.md](KANBAN.md) retains the feature-level priority and links here. Work one task at a time. Before stopping, overwrite the Handoff with current state, decisions, validation, blockers, and the exact next action.

## Product boundary

- External-agent-driven for the initial personal release.
- Weekly reviews are the primary rhythm and support long-term motivation.
- WorkoutPal remains fully usable offline; generating a new review may require connectivity.
- SQLite remains the immediate app source of truth.
- Agents may publish validated reviews and, in a later milestone, pending routine proposals. They never modify history or adopt their own proposal.
- No implementation work is authorized outside the tasks on this board.

## Handoff

- Current: AIC-001 is complete. AIC-002 representative review fixtures is the exact next task. Branch `feature/ai-coach` was created from `main` at `7221ea4` while uncommitted QA-004 work and earlier AI PRD edits were already present. They were preserved; future commits must separate AI Coach files from unrelated QA-004 changes.
- Changes: Added the contract-v1 TypeScript model and strict whole-payload validator in `src/coaching/contracts.ts`, contract tests in `src/coaching/contracts.test.ts`, and the durable external-agent guide in `docs/COACHING_AGENT_GUIDE.md`. Contract v1 is review-only; it rejects unsupported versions, unexpected ownership/routine fields, missing WorkoutPal baseline context, ungrounded claims, malformed dates/content, duplicates, and output that does not match the requested generation context. Updated the npm test command so root and nested test suites both run instead of the shell silently selecting only one level.
- Decisions: Deliver a trustworthy read-only weekly review before routine proposals. Model output never owns a user ID and is never executable data. A trusted publisher binds ownership and validates the whole payload. Continuity check-ins are first-class output when weekly data is insufficient.
- Validation: `npm run typecheck` passes; `npm test` passes 14/14 (7 coaching contract and 7 existing domain tests); `npx expo export --platform ios` passes; `git diff --check` passes.
- Blockers: None for AIC-002. Database access design remains intentionally deferred until the review contract is evaluated and a safe external-agent publishing path is chosen.
- Exact next action: Start AIC-002. Add versioned input/output fixtures for steady progress, apparent plateau, inconsistent weeks, return after a break, and tighter time constraints; record a compact evaluation rubric and verify every output against contract v1.

## Ready

- **AIC-002 Representative review fixtures:** Create valid coaching-context and output fixtures for steady progress, apparent plateau, inconsistent weeks, return after a break, and tighter time constraints. Define minimum usable data and manually evaluate usefulness, evidence accuracy, tone, and repetition.
- **AIC-003 Goal model design:** Freeze initial goal types, priority, target/date semantics, constraints, preferences, and coaching consent. Specify conflict and correction rules.

## In progress

None.

## Verify

None.

## Blocked

None.

## Backlog

- **AIC-004 Goal persistence:** Implement local-first SQLite goal/check-in storage, client-generated IDs, upgrades, repository APIs, and outbox entries; after AIC-003.
- **AIC-005 Goal cloud sync:** Add Supabase migration with explicit grants, RLS ownership policies, sync/merge behavior, and two-user RLS tests; after AIC-004. Do not apply remotely until the migration ledger mismatch in the global handoff is resolved.
- **AIC-006 Goal UI:** Build accessible My Goals and coaching-consent UI with minimal required inputs; after AIC-004.
- **AIC-007 Weekly metrics:** Deterministically calculate timezone-correct review periods, completed sessions, working-set evidence, unit-normalized comparisons, data coverage, and latest included workout. Handle corrections/deletions and sparse weeks; coordinate with WP-005 and WP-024.
- **AIC-008 Coaching context v1:** Assemble a bounded, versioned, user-scoped context from goals, current routine, deterministic metrics, detailed evidence pointers, prior review decision, and data coverage; after AIC-005 and AIC-007.
- **AIC-009 Review persistence:** Add local/cloud review storage, immutable revisions, superseded-data state, stable generation uniqueness, validated publishing boundary, RLS tests, and offline sync; after AIC-001 and AIC-008.
- **AIC-010 External agent workflow:** Configure the chosen project-scoped read path and narrow publishing path, weekly trigger, retries, failure visibility, and copyable setup instructions. Unattended MCP must remain read-only; after AIC-009.
- **AIC-011 Review UI:** Add Coach card, structured weekly review detail, evidence links, confidence/limitations/context visibility, archive, loading/delayed/failure states, and offline reading; after AIC-009.
- **AIC-012 Coaching feedback:** Persist lightweight usefulness/tone feedback and changed constraints locally first, then sync for the next context; after AIC-011.
- **AIC-013 Routine proposal contract:** Define supported routine fields, per-change rationale, safety constraints, source routine version, conflict detection, and invalid-output cases; after WP-013.
- **AIC-014 Proposal persistence and sync:** Store pending/accepted/dismissed proposals with immutable source data, RLS, idempotency, and offline availability; after AIC-013 and AIC-009.
- **AIC-015 Proposal comparison and adoption:** Show before/after changes and accept/edit/dismiss. Preserve the prior routine, never change an active workout, and prevent duplicate or stale application; after AIC-014 and WP-015.
- **AIC-016 Weekly scheduling:** Implement preferred review day/timezone, opt-in notification, duplicate prevention, delayed/offline behavior, retries, and failure visibility; after AIC-010.
- **AIC-017 Security and privacy review:** Threat-model agent credentials, prompt injection from stored text, data minimization, consent, retention/deletion, external context, auditability, and cross-user access. Run advisors and all ownership tests before rollout.
- **AIC-018 End-to-end QA:** Validate offline logging independence, sync recovery, corrected/deleted history, sparse weeks, week/DST boundaries, duplicate runs, invalid agent output, stale routines, accessibility, and physical-iPhone behavior.

## Done

- **AIC-001 Review contract v1:** Added provider-neutral output types, whole-payload validation, generation binding, evidence rules, continuity check-ins, invalid cases, and durable agent guidance. Evidence: typecheck, 14/14 tests, iOS export, and diff check pass on September 12, 2026.

## Validation expectations

- Contract or calculation changes: `npm run typecheck`, `npm test`, fixtures, and `git diff --check`.
- Material app changes: also `npx expo export --platform ios` and relevant physical-iPhone checks.
- Database changes: explicit grants plus RLS, owner/cross-owner tests, and security advisors. Follow current Supabase documentation because Data API defaults and MCP capabilities change.
- Never claim an agent, scheduled review, migration, or E2E flow works until that exact path has been exercised.

## Working-tree ownership

- AIC-001 files: `src/coaching/contracts.ts`, `src/coaching/contracts.test.ts`, `docs/COACHING_AGENT_GUIDE.md`, and this feature board.
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
