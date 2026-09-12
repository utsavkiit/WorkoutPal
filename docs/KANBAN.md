# WorkoutPal Kanban

Updated: September 12, 2026. Single-agent queue. Baseline review was code-only, not device-tested; WP-009/WP-010/WP-031 are implemented but likewise not yet device-tested. A dev build with WP-009/WP-010 was installed and launched on the physical iPhone this session; on-device results are still pending from the user.

## Workflow

- Follow the user's scope; otherwise take the first Ready task. Move its whole line between lanes; keep IDs stable. One active task, no ownership fields.
- Task text is acceptance criteria. Dependencies appear as `after ID`; priority alone is not a dependency. Promote eligible tasks from Backlog.
- Use Verify for unfinished checks and Blocked for external input/access, recording the exact unblock action in Handoff. Done requires acceptance and applicable checks below.
- Before stopping, overwrite Handoff with the current state, files/decisions, validation, and exact next action. Do not accumulate a session log. Read operational docs only when needed.
- Keep Done entries to ID, outcome, and commit/PR or evidence; archive older entries if they grow large.

## Handoff

- Current: WP-032 implementation continues on branch `feature/ai-coach`. Detailed tasks and durable context live in [AI_COACH_KANBAN.md](AI_COACH_KANBAN.md); AIC-001 is pushed as `0d62b75`, AIC-002 representative fixtures is complete and ready to commit, and AIC-003 goal model design is next. QA-004 remains blocked on disk space for actual Detox UI validation; no E2E tests are claimed passing.
- Changes: Added five synthetic weekly-review journeys covering steady progress, apparent plateau, inconsistent weeks, return after a break, and tighter time constraints. Each has a contract-valid expected review and evidence-ID checks. Added a manual quality rubric, minimum-data proposal, critical-failure conditions, and repetition evaluation. Existing unrelated working-tree changes remain preserved.
- Validation: AIC-002 passes `npm run typecheck`, `npm test` (20/20), and `git diff --check`; no external model run is claimed. AIC-001's iOS export passed. QA-004 previously passed its Release simulator Xcode build; actual Detox UI validation remains blocked by disk space.
- Exact next action: Define AIC-003 goal semantics following the feature board. Do not begin persistence, database access, or routine proposals until their preceding feature tasks and security boundaries are complete.
- Prior context: WP-009/WP-010/WP-031 remain in Verify; migration 002 is applied and RLS tests passed previously. Remote migration ledger lists 001/002 as unapplied despite live schema; do not blindly `db push` without repairing ledger. Next feature priority remains WP-001 when product discovery is paused.

## Ready

- **WP-001 Copy history:** Look up the latest completed session containing an exercise; return its sets in order without mixing sessions. Handle no history and unequal set counts.
- **WP-003 Copy preceding set:** New sets inherit available weight/reps from the preceding set, remain incomplete, and preserve bodyweight behavior.
- **WP-005 Exercise records:** Calculate local history, heaviest weight, reps at a given weight, and bodyweight rep records. Normalize units, exclude incomplete sets, distinguish ties/new records, and reflect history corrections.
- **WP-011 Reuse history:** Repeat with fresh IDs and incomplete sets, preserving the original and respecting an existing active workout. Save exercise order/set counts as a named routine.

## In progress

- **WP-032 AI coaching:** Build the external-agent-driven weekly review and later user-approved routine proposals. Follow the detailed queue and handoff in [AI_COACH_KANBAN.md](AI_COACH_KANBAN.md); AIC-003 is next.

## Verify

- **WP-009 Edit history data:** Validate completed weight/reps, name, and date edits; persist offline, enqueue changes, and preserve corrections through remote merge. Implemented via `saveHistoryEdits`; typecheck/tests/export pass. Needs on-device check: edit while offline, restart app, confirm correction persists and later syncs/merges without reverting.
- **WP-010 Edit history UI:** Clear save/cancel and input validation; after WP-009. Implemented in `app/history/[id].tsx`. Needs on-device check: VoiceOver/large-text pass on the new inputs, and that Cancel truly discards in-progress edits.
- **WP-031 Delete history:** Delete a whole completed workout, a single exercise from a past workout, or a single completed set, with the deletion persisting through sync (not just locally). Guards against leaving a workout with zero exercises or an exercise with zero sets — delete the parent instead. Implemented (`deleteWorkout`/`deleteHistoryExercise`/`deleteHistorySet` in `src/data/database.ts`, remote delete handling in `src/data/sync.ts`, trash-icon UI in `app/history/[id].tsx`). `supabase/migrations/002_delete_completed_workouts.sql` is now applied to the linked project and `supabase/tests/rls.sql` passes (confirms an owner can delete their own completed workout and not another owner's). Needs on-device check: delete a set/exercise/workout while offline, confirm it stays deleted after restart and after the next sync (no resurrection via pull), and that the "only exercise"/"only set" guard alerts fire correctly.

## Blocked

- **QA-004 Detox E2E:** Configure local iOS Simulator builds and isolated, repeatable workout logging/history/restart tests; document commands and validate an actual run. Implementation and build are complete; actual Detox run is blocked until several GB of disk space are freed.

## Backlog

Ordered by feature priority; dependencies constrain eligibility.

- **WP-002 Use last workout:** Explicit action fills only empty values, converts lb/kg numerically, handles bodyweight/missing history/set counts, and never completes sets; after WP-001.
- **WP-004 Copy QA:** Verify offline/restart, unit conversion, and set matching; after WP-002, WP-003.
- **WP-006 Exercise detail:** Dated sets, defined record values, simple trend chart, and first-workout/empty states; reachable from workout/history; after WP-005.
- **WP-007 Record feedback:** Noninterrupting new-record indication or post-workout summary; after WP-005.
- **WP-008 Progress QA:** Mixed units, ties, first sessions, corrected history, and iPhone chart readability; after WP-006, WP-007; recheck after WP-012. If estimated 1RM is later added, label the estimate and document formula/valid inputs.
- **WP-012 History QA:** Corrections/reuse work offline, after restart/sync; originals remain intact and previous values reflect edits; after WP-010, WP-011.
- **WP-013 Routine target design:** Optional rep ranges, weight targets, and exercise rest durations; define precedence over copied history.
- **WP-014 Target storage:** Compatible local/remote persistence and sync with defaults preserving existing routines; after WP-013.
- **WP-015 Target UI:** Edit/display targets distinctly from actual performance; targets never complete sets. Verify offline/sync; after WP-014.
- **WP-016 Notes:** Reusable exercise notes; distinguish session notes if included. Implement persistence, sync, and editing.
- **WP-017 Set types:** Warm-up/working labels, existing sets default to working; define consistent treatment in totals, charts, and records.
- **WP-018 Effort tracking decision:** Explicitly defer or implement one explained scale with storage/logging behind an opt-in setting.
- **WP-019 Metadata QA:** Notes/types survive offline logging, reuse, history editing, and sync; after WP-016, WP-017, and WP-018 if implemented.
- **WP-020 Timer controls:** +30 seconds/restart; reschedule notifications and cancel obsolete alerts.
- **WP-021 Exercise rest:** Exercise duration with global fallback; reuse target storage; after WP-014.
- **WP-022 Timer QA:** Adjustments, cancellation, background/foreground accuracy, and notification delivery on physical iPhone; after WP-020, WP-021.
- **WP-023 Live Activity (later):** Scope/implement Lock Screen timer and native lifecycle; separate from basic timer completion.
- **WP-024 Weekly data:** Local completed-workout count and optional weekly goal; define/test local week boundaries.
- **WP-025 Weekly UI:** Home summary and history calendar with empty states; after WP-024.
- **WP-026 Weekly QA:** Offline updates, history date corrections, midnight/DST boundaries; after WP-025.
- **WP-027 Superset data:** Routine/session grouping, repeat/save/sync persistence, and rest timing semantics.
- **WP-028 Superset UI:** Grouping controls and alternating-set flow; preserve ordinary workouts; after WP-027.
- **WP-029 Substitution:** Session-only replacement preserves position and logged performance, uses replacement history, and makes saved-routine changes explicit. Independently deliverable from supersets.
- **WP-030 Group/substitution QA:** Offline, restart, repeat, and sync; after WP-028, WP-029.
- **QA-001:** Physical-iPhone offline logging, reconnect, and sync.
- **QA-002:** Active-workout recovery and timer across backgrounding/restart.
- **QA-003:** Larger text, VoiceOver, touch targets, and keyboard in active workouts.

## Done

None.

## Code entry points

- Copy/logging: `app/workout.tsx`, `src/data/database.ts` (`hydrateSession`, `createWorkout`, `addSet`), `src/domain.ts`.
- Progress/history: `app/history/[id].tsx`, `src/data/{database,repository,sync}.ts`, `src/{domain,types}.ts`; exercise detail needs a route.
- Targets/notes/grouping: `app/routine/[id].tsx`, `app/workout.tsx`, `src/types.ts`, `src/data/database.ts`, `src/components/ExercisePicker.tsx`.
- Timer: `app/workout.tsx` (`TimerBanner`), `src/services/timer.ts`, `src/context/AppContext.tsx`, `app/(tabs)/settings.tsx`.
- Weekly: `app/(tabs)/{index,history}.tsx`, `src/data/database.ts`, `src/utils.ts`.

## Shared acceptance

- Follow `AGENTS.md`: local-first writes, stable client IDs, serialized SQLite/sync, RLS ownership boundaries, and accessible workout controls with minimal prompts. Keep advanced fields optional.
- Persistence changes preserve existing records and cover SQLite upgrades, outbox payloads, remote migrations, and merge behavior as applicable. Relevant flows work offline, after restart, and after sync.
- Verify task criteria and meaningful calculation/transformation regressions. Material changes require `npm run typecheck`, `npm test`, and `npx expo export --platform ios`.
- Record actual results and pending device checks in Handoff; required unverified checks keep the task in Verify.
