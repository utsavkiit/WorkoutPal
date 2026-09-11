#!/usr/bin/env python3
"""
Convert a Strong-app CSV export into a SQL file that inserts completed
workouts directly into WorkoutPal's Supabase tables (owner-scoped, RLS-compatible
shape — same rows the app itself would write via src/data/sync.ts pushPending()).

This writes to Supabase, NOT the phone's local SQLite — the app pulls it down
automatically next time it's foregrounded while signed in (see AppContext.tsx
syncNow on AppState 'active'). See SKILL.md for the full workflow this
script is one step of (owner id + seed exercise lookup happen before this,
via `supabase db query`; SQL execution happens after).

Usage:
  python3 build_import.py \
    --csv path/to/strong_export.csv \
    --owner-id <supabase auth.users.id> \
    --seeds seeds.json \
    --map ../exercise-map.json \
    --unit lb \
    --timezone America/New_York \
    --out import.sql \
    [--existing existing_started_ats.txt]

Inputs you must produce first (see SKILL.md):
  --seeds   JSON array of {id, name, muscle_group, equipment, type} for the
            WorkoutPal seed exercises (owner_id IS NULL), e.g. from:
              supabase db query --linked "select id,name,muscle_group,equipment,type
                from public.exercises where owner_id is null" --output-format json
  --existing (optional) newline-separated list of existing workout_sessions
            .started_at values (UTC, 'YYYY-MM-DD HH:MM:SS+00' as printed by
            supabase db query) for this owner, to skip already-imported
            sessions on a re-run with overlapping data.

Exits non-zero and prints unmapped exercise names (with a ready-to-paste
JSON snippet) if the CSV contains an exercise not yet in exercise-map.json —
add it there and re-run rather than guessing in the script.
"""
import argparse
import csv
import json
import sys
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def parse_duration(s):
    s = s.strip()
    h = m = 0
    if "h" in s:
        parts = s.split("h")
        h = int(parts[0].strip())
        rest = parts[1].strip()
        if rest:
            m = int(rest.replace("m", "").strip())
    elif "m" in s:
        m = int(s.replace("m", "").strip()) if s.replace("m", "").strip() else 0
    return timedelta(hours=h, minutes=m)


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--owner-id", required=True, help="Supabase auth.users.id (uuid)")
    ap.add_argument("--seeds", required=True, help="JSON file: seed exercises (owner_id IS NULL)")
    ap.add_argument("--map", required=True, help="exercise-map.json (Strong name -> seed name or custom def)")
    ap.add_argument("--unit", default="lb", choices=["lb", "kg"])
    ap.add_argument("--timezone", default="America/New_York", help="IANA tz the CSV timestamps were logged in")
    ap.add_argument("--out", required=True, help="SQL output path")
    ap.add_argument("--existing", default=None, help="Optional file of existing started_at values to skip (dedup)")
    ap.add_argument("--stamp", default=None, help="ISO timestamp for new custom-exercise updated_at (default: now, UTC)")
    args = ap.parse_args()

    tz = ZoneInfo(args.timezone)
    stamp = args.stamp or datetime.utcnow().isoformat() + "Z"

    with open(args.seeds) as f:
        seed_rows = json.load(f)
    seed_by_name = {r["name"]: r for r in seed_rows}

    with open(args.map) as f:
        exmap = json.load(f)
    seed_map = exmap.get("seed", {})
    custom_map = exmap.get("custom", {})

    existing_started = set()
    if args.existing:
        with open(args.existing) as f:
            existing_started = {line.strip() for line in f if line.strip()}

    with open(args.csv) as f:
        rows = list(csv.DictReader(f))

    # Verify every CSV exercise name is mapped before doing anything else.
    csv_names = sorted(set(r["Exercise Name"] for r in rows))
    unmapped = [n for n in csv_names if n not in seed_map and n not in custom_map]
    if unmapped:
        print("UNMAPPED exercise names found — add these to exercise-map.json, then re-run:\n", file=sys.stderr)
        for n in unmapped:
            print(f'  "{n}": {{ "name": "???", "muscleGroup": "???", "equipment": "???", "type": "weighted|bodyweight" }}', file=sys.stderr)
        sys.exit(1)

    for n in csv_names:
        if n in seed_map and seed_map[n] not in seed_by_name:
            print(f"exercise-map.json points '{n}' at seed '{seed_map[n]}' but that name isn't in --seeds. "
                  f"Re-fetch seeds or fix the map.", file=sys.stderr)
            sys.exit(1)

    def custom_id(csv_name):
        # Deterministic so re-running the same CSV/owner never creates duplicate custom exercises.
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"workoutpal-custom:{args.owner_id}:{csv_name}"))

    def exercise_info(csv_name):
        if csv_name in seed_map:
            seed = seed_by_name[seed_map[csv_name]]
            return seed["id"], seed["name"], seed["type"]
        c = custom_map[csv_name]
        return custom_id(csv_name), c["name"], c["type"]

    # Group CSV rows into sessions by exact Date value (Strong repeats the session
    # start timestamp on every row belonging to that session).
    sessions, order = {}, []
    for row in rows:
        key = row["Date"]
        if key not in sessions:
            sessions[key] = {"workout_name": row["Workout Name"], "duration": row["Duration"], "exercises": {}, "exercise_order": []}
            order.append(key)
        sess = sessions[key]
        ex_name = row["Exercise Name"]
        if ex_name not in sess["exercises"]:
            sess["exercises"][ex_name] = []
            sess["exercise_order"].append(ex_name)
        sess["exercises"][ex_name].append(row)

    def to_utc(dt_naive_local):
        return dt_naive_local.replace(tzinfo=tz).astimezone(ZoneInfo("UTC"))

    def utc_iso(dt_aware_utc):
        return dt_aware_utc.isoformat().replace("+00:00", "Z")

    def pg_ts(dt_aware_utc):
        # Matches the "YYYY-MM-DD HH:MM:SS+00" format `supabase db query` prints, for dedup comparisons.
        return dt_aware_utc.strftime("%Y-%m-%d %H:%M:%S+00")

    session_out, we_out, set_out, skipped = [], [], [], []
    used_custom = set()

    for key in order:
        sess = sessions[key]
        started_local = datetime.strptime(key, "%Y-%m-%d %H:%M:%S")
        started_utc = to_utc(started_local)
        ended_utc = started_utc + parse_duration(sess["duration"])
        if pg_ts(started_utc) in existing_started:
            skipped.append((key, sess["workout_name"]))
            continue
        started_at, ended_at = utc_iso(started_utc), utc_iso(ended_utc)
        session_id = str(uuid.uuid4())
        session_out.append({"id": session_id, "owner_id": args.owner_id, "name": sess["workout_name"],
                             "started_at": started_at, "ended_at": ended_at, "updated_at": ended_at})
        for sort_order, ex_name in enumerate(sess["exercise_order"]):
            eid, cname, etype = exercise_info(ex_name)
            if ex_name in custom_map:
                used_custom.add(ex_name)
            we_id = str(uuid.uuid4())
            we_out.append({"id": we_id, "session_id": session_id, "exercise_id": eid, "exercise_name": cname,
                            "exercise_type": etype, "sort_order": sort_order, "updated_at": ended_at})
            for set_row in sess["exercises"][ex_name]:
                set_number = int(set_row["Set Order"])
                reps = float(set_row["Reps"])
                seconds = float(set_row.get("Seconds") or 0)
                if etype == "bodyweight":
                    # WorkoutPal sets have no duration field. A timed hold (reps==0, Seconds>0,
                    # e.g. a plank) is stored using the hold length as the rep count so the data
                    # isn't dropped — note this in the import summary for the user.
                    reps_val = int(seconds) if reps <= 0 and seconds > 0 else int(reps)
                    weight = None
                else:
                    reps_val = int(reps)
                    weight = float(set_row["Weight"])
                set_out.append({"id": str(uuid.uuid4()), "workout_exercise_id": we_id, "set_number": set_number,
                                 "weight": weight, "reps": reps_val, "unit": args.unit,
                                 "completed_at": ended_at, "updated_at": ended_at})

    custom_out = []
    for csv_name in used_custom:
        c = custom_map[csv_name]
        custom_out.append({"id": custom_id(csv_name), "owner_id": args.owner_id, "name": c["name"],
                            "muscle_group": c["muscleGroup"], "equipment": c["equipment"], "type": c["type"],
                            "is_custom": True, "archived": False, "updated_at": stamp})

    lines = ["BEGIN;", "-- custom exercises"]
    for e in custom_out:
        lines.append(
            "INSERT INTO public.exercises (id, owner_id, name, muscle_group, equipment, type, is_custom, archived, updated_at) VALUES "
            f"({q(e['id'])},{q(e['owner_id'])},{q(e['name'])},{q(e['muscle_group'])},{q(e['equipment'])},{q(e['type'])},{q(e['is_custom'])},{q(e['archived'])},{q(e['updated_at'])}) "
            "ON CONFLICT (id) DO NOTHING;"
        )
    lines.append("-- workout sessions")
    for s in session_out:
        lines.append(
            "INSERT INTO public.workout_sessions (id, owner_id, routine_id, name, status, started_at, ended_at, updated_at) VALUES "
            f"({q(s['id'])},{q(s['owner_id'])},NULL,{q(s['name'])},'completed',{q(s['started_at'])},{q(s['ended_at'])},{q(s['updated_at'])});"
        )
    lines.append("-- workout exercises")
    batch = [f"({q(e['id'])},{q(e['session_id'])},{q(e['exercise_id'])},{q(e['exercise_name'])},{q(e['exercise_type'])},{e['sort_order']},{q(e['updated_at'])})" for e in we_out]
    for i in range(0, len(batch), 200):
        lines.append(f"INSERT INTO public.workout_exercises (id, session_id, exercise_id, exercise_name, exercise_type, sort_order, updated_at) VALUES {','.join(batch[i:i+200])};")
    lines.append("-- workout sets")
    batch = [f"({q(s['id'])},{q(s['workout_exercise_id'])},{s['set_number']},{q(s['weight'])},{q(s['reps'])},{q(s['unit'])},{q(s['completed_at'])},{q(s['updated_at'])})" for s in set_out]
    for i in range(0, len(batch), 200):
        lines.append(f"INSERT INTO public.workout_sets (id, workout_exercise_id, set_number, weight, reps, unit, completed_at, updated_at) VALUES {','.join(batch[i:i+200])};")
    lines.append("COMMIT;")

    with open(args.out, "w") as f:
        f.write("\n".join(lines))

    print(f"sessions: {len(session_out)} (skipped {len(skipped)} already-imported)")
    print(f"workout_exercises: {len(we_out)}")
    print(f"workout_sets: {len(set_out)}")
    print(f"new custom exercises: {len(custom_out)}")
    for c in custom_out:
        print(f"  {c['name']}  {c['id']}")
    if session_out:
        print(f"date range: {session_out[0]['started_at']} .. {session_out[-1]['started_at']}")
    if skipped:
        print("skipped (already present, by started_at):")
        for key, name in skipped:
            print(f"  {key}  {name}")
    print(f"\nwrote {args.out}")


if __name__ == "__main__":
    main()
