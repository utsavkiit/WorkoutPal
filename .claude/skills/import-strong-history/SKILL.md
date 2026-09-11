---
name: import-strong-history
description: Import a Strong-app workout-history CSV export into WorkoutPal as completed workouts. Use when the user shares a Strong (or similarly-shaped) workout CSV export and asks to add/import/load it into the app / their history / the database.
---

# Import Strong-app CSV history into WorkoutPal

Writes completed workouts straight into Supabase (bypassing the app UI, but
through the same tables/RLS the app itself uses via `src/data/sync.ts`
`pushPending`). The phone's local SQLite is not reachable from here — the
app pulls this down automatically the next time it's foregrounded while
signed in (`AppContext.tsx`, `syncNow` on `AppState` → `'active'`). Tell the
user that at the end; no other action is needed on their side.

Bundled in this skill directory:
- `exercise-map.json` — Strong exercise name → WorkoutPal exercise (seed name, or a custom-exercise definition). Extend it, don't recreate it, when a CSV brings a name that isn't covered yet.
- `scripts/build_import.py` — parses the CSV, converts local timestamps to UTC, applies the map, and emits a single transactional `import.sql`.

## Schema recap (don't re-derive this — read database.ts/sync.ts only if something here doesn't match)

Supabase tables (see `supabase/migrations/001_workoutpal.sql`): `exercises`,
`workout_sessions`, `workout_exercises`, `workout_sets`. Seed exercises have
`owner_id IS NULL`; user-added ones have `owner_id = auth.uid()` and
`is_custom = true`. A `workout_sessions` row needs `status='completed'` and
a non-null `ended_at`. `workout_sets.weight` is `NULL` for bodyweight sets
(never `0`). `unit` is `'lb'` or `'kg'`, required on every set regardless of
whether weight is used.

## Steps

1. **Locate the CSV.** If the user didn't give a path, ask. Sanity-check the header: `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE`. If the shape differs meaningfully, this skill may not fit — fall back to manual handling.

2. **Resolve the owner's Supabase user id:**
   ```bash
   npx supabase db query --linked "select id, email from auth.users;"
   ```
   If there's exactly one user, use it. If more than one, ask the user which email. (Requires the Supabase CLI already logged in / project linked — it was as of Sep 2026; if not, `npx supabase login` then `npx supabase link`.)

3. **Fetch current seed exercises** (don't hardcode these — the seed list can grow):
   ```bash
   npx supabase db query --linked "select id, name, muscle_group, equipment, type from public.exercises where owner_id is null;" > /tmp/seeds_raw.json
   ```
   That command's output is human-pretty JSON wrapped with a `boundary`/`warning` envelope (from `supabase db query`'s untrusted-data framing) — extract just the `rows` array into a clean JSON file (e.g. with `python3 -c "import json,re; ..."` or `jq '.rows'` after stripping the leading log line) before passing it as `--seeds`.

4. **Check for exercises not yet in `exercise-map.json`.** Get the CSV's unique `Exercise Name` values and diff against the `seed` + `custom` keys in `exercise-map.json`. For any new name, decide: does it match an existing seed exercise closely enough (same movement, e.g. "Squat (Barbell)" → "Back Squat"), or does it need a new custom exercise (different equipment/variant that would misrepresent history if merged, e.g. a dumbbell variant of a barbell seed)? When unsure, prefer a custom exercise over a loose seed match — it preserves fidelity and costs nothing. Add the new mapping(s) into `exercise-map.json` (Edit, not overwrite) before running the script — it exits non-zero and tells you exactly which names are unmapped if you skip this.

5. **(Optional dedup)** If this CSV might overlap a previous import for the same person, fetch existing session timestamps first so the script can skip them:
   ```bash
   npx supabase db query --linked "select started_at from public.workout_sessions where owner_id='<uuid>';" 
   ```
   Extract the `started_at` values (one per line) to a file and pass as `--existing`.

6. **Ask the user** (don't assume) if not already known from context:
   - Weight unit the CSV was logged in (`lb` vs `kg`) — the CSV has no unit column.
   - Confirm the IANA timezone the workouts were actually logged in if it's unclear (default assumption: `America/New_York`, matching this user's usual timezone) — get this wrong and every session's displayed date/time shifts.

7. **Run the script:**
   ```bash
   python3 .claude/skills/import-strong-history/scripts/build_import.py \
     --csv <path-to-csv> \
     --owner-id <uuid> \
     --seeds /tmp/seeds_clean.json \
     --map .claude/skills/import-strong-history/exercise-map.json \
     --unit lb \
     --timezone America/New_York \
     --out /tmp/import.sql \
     [--existing /tmp/existing_started_ats.txt]
   ```
   Read its printed summary (session/exercise/set counts, date range, any new custom exercises, any skipped-as-duplicate sessions).

8. **Confirm with the user before writing to production** — this is a real write to their Supabase account outside the normal app flow. Summarize: session count, date range, new custom exercises that will be created, and any known caveats (e.g. a bodyweight exercise whose reps were backfilled from a `Seconds` column because WorkoutPal sets have no duration field — call this out if `build_import.py`'s logic triggered it, i.e. any bodyweight row where CSV `Reps` was `0`/blank and `Seconds` wasn't).

9. **Execute:**
   ```bash
   npx supabase db query --linked -f /tmp/import.sql
   ```

10. **Verify** row counts landed (run each as its own query — a single query combining multiple scalar subqueries has been observed to return stale/wrong counts through this CLI path, unlike separate queries):
    ```bash
    npx supabase db query --linked "select count(*) from public.workout_sessions where owner_id='<uuid>';"
    npx supabase db query --linked "select count(*) from public.workout_exercises we join public.workout_sessions w on w.id=we.session_id where w.owner_id='<uuid>';"
    npx supabase db query --linked "select count(*) from public.workout_sets ws join public.workout_exercises we on we.id=ws.workout_exercise_id join public.workout_sessions w on w.id=we.session_id where w.owner_id='<uuid>';"
    ```
    Cross-check against the script's printed counts (plus any pre-existing rows for that owner, and minus anything skipped for dedup).

11. **Clean up** temp files (`/tmp/seeds_raw.json`, `/tmp/import.sql`, etc.) and tell the user: counts imported, any new custom exercises created, any caveats, and that opening/foregrounding the app while signed in will pull the history down.

## Notes for next time

- The `exercise-map.json` in this skill only covers the ~31 exercise names seen in the first import (Sep 2026). Keep adding to it as new CSVs bring new names — that's the main thing that makes each future import faster and cheaper than re-deriving mappings from scratch.
- `build_import.py` is idempotent for custom-exercise creation (deterministic UUIDs keyed by owner+name, `ON CONFLICT DO NOTHING`) but **not** for sessions — always pass `--existing` when the CSV might overlap a prior import, or duplicate history rows will be created.
