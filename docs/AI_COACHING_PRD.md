# AI Coach — product requirements draft

Status: Refined concept for user review; not approved for implementation. Updated September 12, 2026.

## Product vision

WorkoutPal's AI Coach helps the user stay motivated through a long training journey by making progress visible, putting setbacks in perspective, and turning the user's real history into an achievable next step. It reviews what the user actually did, connects recent work to longer-term goals, and adapts the plan when a change would help the user keep progressing.

Routine optimization is a means, not the primary outcome. The coach succeeds when the user understands their progress, feels that the next step is attainable, and continues training over time. It is a decision-support layer, not an autonomous trainer: it never edits a routine or an active workout without the user's approval, and workout logging continues to work without the coach, a network connection, or a cloud account.

## User promise

> WorkoutPal helps you see how far you have come, understand what is moving you forward, and choose an achievable next step toward your goal—even when progress is slow or life interrupts the plan.

## Target user and problem

The initial user already logs strength workouts but finds it difficult to recognize meaningful progress across months. Day-to-day performance is noisy, motivation fades when improvement is not obvious, and one interrupted week can feel like losing momentum. The user wants encouragement and direction grounded in their own journey—not empty praise, guilt, or a generic AI-generated program.

The product must answer four questions:

1. **What progress have I made, including progress that is easy to overlook?**
2. **How does my recent training relate to my longer-term goal?**
3. **What in my history supports that conclusion?**
4. **What is the most achievable next step, and why is it right for me now?**

## Motivation model

The coach supports long-term motivation through three reinforcing experiences:

- **Evidence of progress:** surface concrete wins such as improved performance, greater consistency, returning after time away, or completing more of an intended plan.
- **A sense of continuity:** frame an imperfect week as one part of a longer journey. Avoid resetting the narrative, breaking punitive streaks, or treating absence as failure.
- **An achievable next step:** reduce uncertainty to one clear focus and a routine the user can realistically perform within current constraints.

Encouragement must be specific and earned. The coach cites the behavior or result it is recognizing and avoids exaggerated praise, pressure, shame, or comparisons with other users.

## Product principles

- **History before advice.** Recommendations are grounded in completed WorkoutPal records and explicit user context. The coach never invents workouts, availability, recovery, or equipment.
- **Goals drive interpretation.** The same history can justify different recommendations for strength, muscle gain, consistency, or maintenance.
- **Progress is broader than personal records.** Consistency, technique-friendly repetition, returning after a break, and maintaining performance under tighter constraints may all be meaningful when they support the user's goal.
- **Protect continuity.** A missed or reduced week should produce a practical re-entry step, not a broken-streak penalty or an unnecessarily aggressive catch-up plan.
- **Prefer the smallest useful adjustment.** Preserve effective parts of the current routine and change only what the evidence or a new constraint justifies.
- **Explain every material change.** Show the observation, recommendation, expected benefit, and uncertainty in plain language.
- **The user remains the editor.** Proposals can be accepted, edited, or dismissed. They never alter an active workout and can never be applied twice.
- **Offline logging is inviolable.** AI failure, sync failure, or no connectivity must not block starting, recording, or finishing a workout.
- **Honest scope is safer than false precision.** Missing or sparse data lowers confidence. The coach does not diagnose injuries, prescribe rehabilitation, or present estimated trends as measured facts.

## Supported goals in the first release

- Improve general strength.
- Improve one or more selected lifts.
- Build muscle through resistance training.
- Train more consistently.
- Maintain current performance with a stated time constraint.

Each goal has a priority, optional target and date, and a user-defined success measure. Body-composition, nutrition, rehabilitation, and sport-specific plans are deferred until WorkoutPal has the inputs and safeguards required to support them responsibly.

## Core experience

### 1. Set direction

In **My goals**, the user provides:

- primary goal and optional target/date;
- training experience;
- days per week and approximate session length;
- available equipment;
- exercises to prioritize, avoid, or substitute;
- known limitations the user wants the coach to respect; and
- units and timezone.

Only the goal and a minimum training constraint should be required. Advanced fields remain optional and can be refined later.

### 2. Establish a baseline

Before the first review, WorkoutPal shows the coach's usable evidence: completed workouts, date coverage, frequently trained exercises, and the current routine. The coach proceeds with limited data when possible, labels its confidence, and asks for at most the one missing fact that would materially change the recommendation.

With no usable history, the coach may propose a conservative starter routine from the user's goal and constraints, but must label it as a starting hypothesis rather than a history-based recommendation.

#### How historical records are used

The coach should not treat all history as equally relevant:

- the **current training block** supplies the primary evidence for adherence, workload, and recent progression;
- the **preceding comparable period** shows whether those signals are improving, stable, or declining;
- **long-term history** supplies personal baselines, prior records, exercise familiarity, and recurring patterns; and
- the **current saved routine and accepted targets** establish what the user intended to do, when that intent is actually recorded.

The contract will define exact windows only after representative data is tested; the review always states the dates it used. WorkoutPal should calculate deterministic facts—such as completed sessions, set counts, unit-normalized loads, and dated records—before AI interpretation. The model explains and recommends; it is not the sole calculator of training metrics.

If a user corrects or deletes history included in a review, that review remains an immutable snapshot but is marked as based on superseded data. A new review can then be requested without creating a duplicate.

### 3. Review the training record

The coach produces a concise review with:

- **Headline:** one-sentence assessment of progress toward the goal;
- **Journey highlight:** one specific, evidence-backed sign of progress or persistence worth recognizing;
- **Evidence:** 2–4 observations tied to specific workouts, exercises, and date ranges;
- **Progress signals:** relevant consistency, frequency, completed working sets, rep/weight progression, and record trends that WorkoutPal can calculate reliably;
- **Limitations:** missing, stale, or ambiguous data and the resulting confidence level;
- **Next achievable step:** the single most important, realistic training focus for the next block; and
- **Context used:** WorkoutPal data and any optional sources actually consulted.

An unlogged session is never called a missed workout unless the user had an explicit schedule. The review never uses shame, a broken streak, or a demand to compensate for missed work. Volume comparisons do not treat different exercises as interchangeable, and incomplete sets are excluded from performance claims.

### 4. Recommend the next routine

A review may include one structured routine proposal. The proposal must:

- fit the stated training days, time, equipment, and exercise constraints;
- preserve useful parts of the current plan;
- include exercises, ordering, sets, and rep targets supported by WorkoutPal's routine model;
- explain every exercise added or removed and every material dosage change;
- distinguish goal-driven changes from changes caused by availability or preference;
- name the history window and source routine version used;
- state what the user should watch for before the next review; and
- avoid unsupported specificity when the record is sparse.

Weight targets, rest targets, effort targets, supersets, and substitutions appear only after the corresponding WorkoutPal features can store, display, and sync them consistently.

### 5. Keep the user in control

The proposal view shows a before/after comparison. The user can:

- **Accept** it as a new saved routine version for future workouts;
- **Edit and accept** it through the ordinary routine editor;
- **Dismiss** it, optionally stating why; or
- keep it pending while continuing the current routine.

Acceptance preserves the prior routine, never changes an active workout, and is idempotent. If the source routine changed after the proposal was generated, the app warns the user and requires a fresh comparison instead of silently overwriting newer work.

### 6. Learn from outcomes

At the next review, the coach compares the recommendation with what the user subsequently completed. A lightweight check-in can capture availability changes, difficulty, recovery concerns, and feedback on the prior proposal. The coach should adapt to accepted or rejected advice without treating a dismissal as failure or demanding an explanation.

When training has paused, the next experience should emphasize resuming safely and easily. The coach recognizes the return itself as progress and proposes a manageable re-entry rather than trying to recover all missed volume.

## Review cadence

The primary coaching rhythm is a **weekly review**. The user chooses a preferred review day and can pause or change the cadence. Each review covers the completed local week in the user's timezone while using earlier history for comparison and long-term context.

The intended experience generates the review automatically when the weekly period closes and synced data is available. The app may notify the user that the review is ready, subject to an explicit notification preference. Generation retries must be idempotent, visible when delayed, and must never block workout logging.

When the week contains too little new data for a meaningful analysis, the coach does not manufacture observations or repeat the previous review. It provides a short continuity check-in: acknowledge the available record, ask whether constraints changed, and offer one manageable re-entry step. No logged workouts does not automatically mean the user failed or missed planned sessions.

The user may request an off-cycle review after a material goal, constraint, routine, or history change. Otherwise, the coach should resist frequent regeneration; long-term trends are more useful than reacting to every workout.

## Recommendation policy

The coach follows these rules regardless of model or execution provider:

- Current explicit goals and constraints outrank inferred preferences and older context.
- Recent history is weighed more heavily, while longer history establishes baseline performance and recurring patterns.
- A plateau is not declared from a single session or normal day-to-day variation.
- Short-term regressions are placed in the context of the longer trend and recent constraints rather than framed as lost progress.
- Low confidence produces a conservative proposal or no proposal—not fabricated certainty.
- Pain, illness, alarming symptoms, or requests for diagnosis trigger a clear boundary and appropriate professional-care guidance; they do not produce a rehabilitation plan.
- Advice is expressed as a proposal with reasoning, not as a guarantee of results.
- The coach must not recommend a workload jump that violates the product's eventual safety thresholds; thresholds require separate domain review before implementation.

## Product surfaces

- **My goals:** goal, constraints, preferences, and data-coverage preview.
- **Coach card:** latest review status and headline, accessible from the Workout screen without interrupting logging.
- **Review detail:** journey highlight, evidence, uncertainty, next achievable step, context used, and feedback.
- **Routine proposal:** before/after comparison with accept, edit, and dismiss actions.
- **Coach archive:** prior reviews, proposals, decisions, and routine versions.

The active-workout experience should show only already-approved targets. Coaching prompts and proposal decisions belong outside the active workout flow.

## Data and coaching contract

Names are illustrative; the schema is not approved.

| Record/view | Purpose |
| --- | --- |
| `training_goals` | Dated goals, constraints, preferences, priority, and success measure |
| `coach_check_ins` | Optional availability, difficulty, recovery, and proposal feedback |
| `agent_coaching_context` | Versioned briefing with goals, current routine version, data coverage, recent decisions, and pointers to detailed history |
| `coach_reviews` | Structured assessment, journey highlight, evidence references, confidence, limitations, sources, and next achievable step |
| `routine_proposals` | Proposed routine payload, rationale per change, source routine version, status, and applied routine ID |

Every generated record includes the user owner, author/provider, contract version, generation time, analyzed date range, latest included workout, and a stable generation key. A `(user, review period, generation key)` rule prevents retry duplicates while allowing a revised review after corrected history.

WorkoutPal validates all generated writes; prose from a model is never treated as an executable routine. Authorized access must be user-scoped. A service-role credential is never placed in the client or handed to an external agent, and an administrative connection must not be mistaken for user-level ownership enforcement. All exposed Supabase data remains protected by RLS in addition to application validation.

Goals, feedback, accepted proposals, and downloaded reviews are stored locally first or cached in SQLite as appropriate. Sync is durable and serialized with existing database operations.

## Delivery approach

Keep the product contract independent of the AI provider.

For the first proof of value, one connected external agent can read the versioned coaching context and publish contract-valid reviews/proposals. WorkoutPal provides copyable setup instructions and a short starter prompt; a custom WorkoutPal MCP server is not required. This path is acceptable only after the connection's credential and ownership model is verified.

The proof-of-value reviews may be initiated manually while their content and tone are validated, but they use the same weekly window and output contract as the intended product. The releasable experience requires a user-scoped scheduled runner with retry and failure visibility. Generation can later move between providers without changing the app's review or proposal model. In-app chat is not required.

Example starter prompt:

> Read my WorkoutPal coaching context and follow its versioned contract. Review my completed training against my current goal and constraints. Use only sources available in this session, state the dates and limitations, and publish one concise review plus a routine proposal only if the evidence justifies a change. Leave adoption to me.

## Optional external context

WorkoutPal data is the dependable baseline. Connected health data, chats, or memory may enrich a review only when the user authorizes them and the execution environment can actually access them.

Each review lists sources consulted, relevant date ranges, and material unavailable or stale data. Store only necessary source metadata and coaching conclusions—not raw private chats or health records. A different agent or scheduled runner does not automatically inherit ChatGPT context.

A fact inferred from external context becomes reusable only through an explicit **Save this preference to WorkoutPal** action. Store its source and confirmation date and allow editing or removal. Reading external context does not authorize copying it wholesale into WorkoutPal.

## MVP scope

The first releasable slice includes:

- goal and constraint setup;
- visible training-data coverage;
- an opt-in weekly, history-grounded review with selectable review day and timezone-correct boundaries;
- a continuity check-in when the week has insufficient new training data;
- visible pending, delayed, ready, and failed generation states with safe retry behavior;
- one explainable routine proposal with before/after comparison;
- accept, edit, dismiss, version-conflict, and duplicate-application handling;
- lightweight feedback;
- offline access to previously synced reviews and proposals; and
- clear author, source, date-range, confidence, and missing-data labels.

Out of scope: in-app chat, autonomous routine replacement, daily coaching summaries, multi-agent coordination, nutrition/body-composition coaching, medical or rehabilitation advice, raw health-data ingestion, and provider selection UI.

## Success measures

The MVP succeeds when:

- users report that the review makes their progress clearer and their next workout feel achievable;
- a user can understand why the coach reached its conclusion without inspecting raw data;
- every material proposal change cites a goal, constraint, or historical observation;
- the user can adopt or edit a proposal without losing the previous routine or affecting an active workout;
- reviews remain useful with WorkoutPal data alone and disclose sparse or stale evidence;
- logging remains fully functional when coaching generation and sync are unavailable; and
- across the pilot, users continue logging across multiple weeks, return for another review, and accept, edit, or explicitly dismiss proposals rather than ignoring them.

The primary pilot outcome is **sustained training engagement**, measured as the share of reviewed users who log workouts in at least three of the following four weeks. Pair this with a short self-report—“I can see my progress” and “My next step feels achievable”—because workout frequency alone cannot establish motivation or coaching quality.

Supporting metrics: review completion rate, return-to-training rate after a gap, proposal decision rate, accept-vs-edit-vs-dismiss mix, time to proposal decision, percentage of explanations with valid evidence links, repeat review rate after 2 and 4 weeks, and rate of manual corrections or unsafe-advice reports. Do not optimize for proposal acceptance, workout frequency, streak length, or workload increases in isolation; each can reward unhealthy or irrelevant behavior.

For cadence quality, also measure weekly review delivery reliability, time from the user's chosen review boundary to availability, notification opt-in, review-open rate, and the rate of repetitive or insufficient-data reviews.

## Dependencies and sequencing

AI coaching should build on reliable history and routine semantics rather than define them ad hoc. Relevant roadmap dependencies are exercise records (WP-005), routine target design/storage/UI (WP-013–015), and weekly data definitions (WP-024–026). Routine versioning and goal/check-in persistence need explicit tasks before implementation.

Recommended discovery sequence:

1. Validate the motivational review and before/after proposal format using representative journeys: steady progress, an apparent plateau, inconsistent weeks, return after a break, and progress under tighter time constraints.
2. Finalize supported goals, metric definitions, minimum usable history, and routine-change safety thresholds with domain review.
3. Choose and threat-model the user-scoped agent credential/execution path.
4. Freeze a versioned read/write contract with fixtures and invalid-output cases.
5. Create implementation tasks only after the above decisions are approved.

## Decisions for user review

This draft recommends, but does not yet assume approval of, two choices:

1. Begin with strength, muscle gain, consistency, and maintenance goals; defer nutrition, body composition, and rehabilitation.
2. Have the coach modify the current plan conservatively by default; offer a full rebuild only when the goal, constraints, or available routine are fundamentally incompatible.

Weekly reviews are the approved primary cadence. Track approval and implementation work in [KANBAN.md](KANBAN.md). This document remains a product concept until the remaining decisions and the scheduled access model are resolved.
