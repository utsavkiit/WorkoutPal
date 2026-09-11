# AI coaching — draft PRD

Status: Idea for discussion; not approved for implementation. Updated September 11, 2026.

## Outcome

Let a connected external agent review training against the user's goals and publish weekly reviews and routine proposals that appear inside WorkoutPal. Keep the experience useful offline and leave routine changes under the user's control.

## Proposed experience

1. User saves goals, priorities, experience, available days/session length, equipment, exercise preferences, units, and timezone in **My goals**.
2. User authorizes an existing Supabase MCP connection in their preferred agent and copies a short starter prompt from WorkoutPal. No custom WorkoutPal MCP server is required.
3. User logs workouts normally, optionally adding a weekly check-in about constraints or next week's availability.
4. Agent reads the coaching context and synced history, optionally considers authorized personal/chat and connected health context available in that session, then writes a structured review and optional routine proposal to Supabase. Runs can be requested manually; automatic weekly runs require a separately configured scheduler/agent runner.
5. App syncs the results into SQLite. A Workout-screen card opens the latest review; a Coach archive retains previous reviews.
6. User inspects a proposal's explanation and before/after changes, then accepts, edits, or dismisses it. Acceptance saves through the normal local-first routine flow, preserves the previous plan, and never changes an active workout.
7. User feedback becomes context for the next review. Saving feedback does not imply an immediate agent response.

## Agent context and publishing contract

Proposed names below are illustrative, not a finalized schema.

| Record/view | Purpose |
| --- | --- |
| `training_goals` | Dated goals, preferences, and constraints |
| `agent_coaching_context` | Single briefing entry point: versioned agent instructions, goals, current plan, recent reviews/feedback, data coverage, and pointers to detailed history |
| `coach_reviews` | Weekly summary, evidence linked to workouts, observations, uncertainty, and next actions |
| `routine_proposals` | Structured exercises/targets, rationale, source routine version, and pending/accepted/dismissed state |

Keep agent instructions separate from personal goals. Maintain a canonical, versioned agent guide in the repository (proposed `docs/COACHING_AGENT_GUIDE.md`, to be authored later) and publish its instructions through the briefing. It documents read/write tables, metric definitions, output examples, ownership boundaries, and duplicate prevention.

A starter prompt identifies the context entry point; agents do not discover it automatically. Example: “Read my WorkoutPal agent_coaching_context and follow its contract. Review my training and consider relevant personal context and connected health sources authorized and available in this session. Publish this week's review and any routine proposal, stating sources used and missing data. Leave routine adoption to me.”

## Optional external context

WorkoutPal data is the dependable baseline. Context from other chats/memory and connected health sources is optional enrichment, conditional on the agent's actual session access, settings, and user authorization. Do not promise full chat recall or assume that a health integration is available alongside Supabase. A different agent or scheduled runner does not automatically inherit ChatGPT context; verify access for each execution environment before relying on it.

Each review includes a **Context used** section listing sources actually consulted, relevant date ranges, and material unavailable or stale data. For example: “WorkoutPal workouts and goals; sleep data September 7–13; recent recovery data unavailable.” Record only necessary source metadata and coaching conclusions, not raw private chats or health records. If external sources are unavailable, proceed with WorkoutPal data and disclose the limitation.

Offer an explicit **Save this preference to WorkoutPal for future reviews** action for a user-reviewed fact derived from external context. Persist its source and confirmation date, and allow editing/removal. This makes approved context portable between agents; reading external context does not authorize copying it wholesale into WorkoutPal. Current explicit goals and corrections take precedence over older remembered preferences; ask when a material conflict cannot be resolved.

## Requirements

- Reviews show author, generation time, analyzed dates, and latest included synced workout. Missing or stale data is explicit; unlogged sessions are not automatically missed sessions.
- Numerical claims use consistently calculated metrics and supporting records; distinguish observations from suggestions.
- Validate structured writes and contract versions. Identify the owner and author; define a weekly deduplication/revision rule so retries do not duplicate posts.
- Authorized agent access is scoped to the user and coaching actions. Do not assume an administrative MCP connection enforces user-level RLS; resolve credentials and ownership enforcement before building.
- Previously synced reviews/proposals are readable offline. Goal edits, feedback, and proposal acceptance persist locally and sync durably with serialized database operations.
- Applying a proposal twice must not duplicate routines. Detect proposals based on routines changed since generation before applying them.

## Initial scope and success criteria

My goals, copyable agent setup instructions, weekly review card/archive with source visibility, proposal comparison with accept/edit/dismiss, brief feedback, and explicit saving of reusable preferences. Start with one connected agent; keep author metadata for future extensibility.

Success: a newly connected agent can start from the briefing, publish a valid review and proposal, and the user can read them offline after sync and adopt a proposal without losing the previous routine. Reviews work with WorkoutPal data alone and clearly distinguish any external sources used or unavailable. External facts become reusable profile context only after explicit user confirmation. Existing workout logging remains independent of agent availability.

Out of scope initially: in-app chat, custom MCP server, autonomous routine replacement, multi-agent coordination, built-in health integrations/raw health-data ingestion, and choosing a built-in scheduling provider.

## Decisions to revisit before implementation

- Which agent connection and credential model can enforce the intended access boundaries?
- Start with manual reviews or include an externally scheduled weekly workflow? Who owns setup, retries, and failure visibility?
- Final context/output schema, history window, calculated metrics, week boundaries, and review revision behavior after history corrections.
- Coach navigation placement, optional notifications, and minimum goal/check-in fields.
- Routine versioning, target precedence, and conflict handling on acceptance.
- Verify chat/memory and health-source availability in the chosen agent and scheduled workflow; finalize source metadata and user-confirmed preference storage/edit/removal.

Related roadmap work: exercise records (WP-005), routine targets (WP-013–015), and weekly summaries (WP-024–026). Track priority and implementation tasks in [KANBAN.md](KANBAN.md); refine this draft before promoting work.
