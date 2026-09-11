# WorkoutPal Kanban

Updated: September 10, 2026. Single-agent queue; no implementation started. Baseline review was code-only, not device-tested.

## Workflow

- Follow the user's scope; otherwise take the first Ready task. Move its whole line between lanes; keep IDs stable. One active task, no ownership fields.
- Task text is acceptance criteria. Dependencies appear as `after ID`; priority alone is not a dependency. Promote eligible tasks from Backlog.
- Use Verify for unfinished checks and Blocked for external input/access, recording the exact unblock action in Handoff. Done requires acceptance and applicable checks below.
- Before stopping, overwrite Handoff with the current state, files/decisions, validation, and exact next action. Do not accumulate a session log. Read operational docs only when needed.
- Keep Done entries to ID, outcome, and commit/PR or evidence; archive older entries if they grow large.

## Handoff

- Current: None. All tasks unstarted.
- Next: WP-001 unless the user selects another task; inspect `src/data/database.ts` and `app/workout.tsx`.
- Changes/decisions: Documentation only. Suggested next release: copy values, exercise progress, edit/reuse history.
- Validation/blockers: No runtime checks performed; no known blocker. QA tasks describe unverified behavior, not confirmed defects.

## Ready

- **WP-001 Copy history:** Look up the latest completed session containing an exercise; return its sets in order without mixing sessions. Handle no history and unequal set counts.
- **WP-003 Copy preceding set:** New sets inherit available weight/reps from the preceding set, remain incomplete, and preserve bodyweight behavior.
- **WP-005 Exercise records:** Calculate local history, heaviest weight, reps at a given weight, and bodyweight rep records. Normalize units, exclude incomplete sets, distinguish ties/new records, and reflect history corrections.
- **WP-009 Edit history data:** Validate completed weight/reps, name, and date edits; persist offline, enqueue changes, and preserve corrections through remote merge.
- **WP-011 Reuse history:** Repeat with fresh IDs and incomplete sets, preserving the original and respecting an existing active workout. Save exercise order/set counts as a named routine.

## In progress

None.

## Verify

None.

## Blocked

None.

## Backlog

Ordered by feature priority; dependencies constrain eligibility.

- **WP-002 Use last workout:** Explicit action fills only empty values, converts lb/kg numerically, handles bodyweight/missing history/set counts, and never completes sets; after WP-001.
- **WP-004 Copy QA:** Verify offline/restart, unit conversion, and set matching; after WP-002, WP-003.
- **WP-006 Exercise detail:** Dated sets, defined record values, simple trend chart, and first-workout/empty states; reachable from workout/history; after WP-005.
- **WP-007 Record feedback:** Noninterrupting new-record indication or post-workout summary; after WP-005.
- **WP-008 Progress QA:** Mixed units, ties, first sessions, corrected history, and iPhone chart readability; after WP-006, WP-007; recheck after WP-012. If estimated 1RM is later added, label the estimate and document formula/valid inputs.
- **WP-010 Edit history UI:** Clear save/cancel and input validation; after WP-009.
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
