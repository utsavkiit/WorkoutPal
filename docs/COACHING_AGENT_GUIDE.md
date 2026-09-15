# WorkoutPal coaching agent guide

Status: Contract v1 foundation. Review publishing is not connected to persistence yet.

## Purpose

This guide is the durable handoff between WorkoutPal and an external coaching agent. The agent reviews completed training against explicit goals and publishes a concise weekly review. WorkoutPal remains offline-first, and the user retains control of every routine change.

The canonical runtime types and validator live in `src/coaching/contracts.ts`. If this guide and the code disagree, stop and update them together rather than guessing.

## Current capability

Contract v1 accepts two review kinds:

- `weekly_review`: enough completed training exists for evidence-backed observations.
- `continuity_check_in`: too little new data exists for a meaningful review; provide a non-judgmental re-entry step without inventing activity.

Routine proposal publishing is intentionally unsupported in v1. Do not write or mutate routines, goals, workouts, or workout sets.

## Publishing boundary

The agent returns one JSON object matching `CoachReviewDraftV1`. For direct Supabase MCP access, publish only through `public.publish_coach_review_v1(request_id, review_json)`; the database function binds ownership, IDs, versions, generation key, review dates, latest included workout, and timestamps before persistence. Contract v1 rejects unexpected fields, including ownership and routine-proposal fields, and requires WorkoutPal to appear as the baseline context source.

The model output never supplies the owning user ID. Ownership comes from the authenticated publishing boundary. Reject the entire payload when validation fails; never partially save or silently repair it.

Required protections before a database publisher is implemented:

- use a project-scoped connection;
- do not expose a service-role key to a mobile client or model;
- grant only the minimum Data API privileges explicitly;
- enable RLS and test both owner and cross-owner behavior;
- keep unattended Supabase MCP access read-only; and
- perform writes through a narrow, validated publishing path rather than arbitrary agent SQL.

## Review rules

- Use only completed workouts for performance claims.
- Cite supporting WorkoutPal workout IDs for every progress, consistency, or constraint observation.
- Do not call an unlogged session missed unless an explicit schedule exists in the supplied context.
- Do not infer pain, recovery, sleep, equipment, or availability.
- Treat recent data as the primary signal and longer history as personal context.
- Do not declare a plateau from one session.
- Prefer one achievable next step over a list of optimizations.
- Use specific, earned encouragement; avoid guilt, punitive streaks, exaggerated praise, or comparisons with other users.
- Disclose sparse, stale, unavailable, or conflicting context in `limitations` and lower confidence.
- Do not diagnose injury, prescribe rehabilitation, or guarantee results.

## Idempotency and revisions

The caller provides `generationKey`, `periodStart`, `periodEnd`, and `latestWorkoutId`. Echo them exactly. The publisher will use the generation key to prevent duplicate weekly reviews.

A correction to included workout history does not mutate an existing review. A later task will mark that review as based on superseded data and generate a new revision with a new generation key.

## Example

Executable examples and invalid cases are maintained in `src/coaching/contracts.test.ts`. Use those fixtures when changing the contract. Any contract change requires a new version or an explicitly backward-compatible validator update plus tests.
