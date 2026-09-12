# AI Coach goal and profile model

Status: AIC-003 contract design. Persistence is not implemented.

The canonical v1 types and validator live in `src/coaching/goals.ts`. The profile is local-first once AIC-004 is implemented; this document defines semantics only.

## Initial goal set

V1 supports up to three ranked goals and requires exactly one active primary goal:

- general strength;
- strength in one selected lift with an optional dated weight-and-rep target;
- hypertrophy for selected muscle groups;
- consistency expressed as completed sessions per week; and
- maintenance for selected exercises under the profile's time constraints.

Priority determines interpretation when goals conflict. Priority 1 wins, followed by 2 and 3. A lower-priority goal must never cause a recommendation that materially undermines the primary goal without explicitly presenting the tradeoff to the user.

The optional `motivation` field captures why the goal matters to the user. It may guide tone and practical choices but is never used for authorization or treated as factual health data.

## Constraints and preferences

Constraints describe current capacity: available days per week, approximate session length, equipment, and optional considerations the user wants respected. Preferences identify exercises to favor or avoid. An exercise cannot be both preferred and avoided.

Constraints outrank preferences. Explicit avoided exercises outrank preferred exercises and inferred exercise familiarity. The coach must not interpret free-text considerations as a diagnosis or invent medical restrictions.

## Weekly review schedule

The user selects an IANA timezone and day of week (`0` Sunday through `6` Saturday). These fields define the review boundary; actual scheduling and DST behavior belong to AIC-016. Notifications are separately optional.

Weekly scheduling can be enabled only while coaching is enabled. Turning coaching off must stop new generation without affecting ordinary local workout logging.

## Consent

External coaching requires explicit consent to share synced workout history. Coaching consent and notification preference are separate. Optional check-ins are included only when separately enabled.

The external model never receives the profile's owner ID as an output field. The authenticated publishing boundary supplies ownership. Revoking consent stops future context assembly and generation. A later privacy task will specify remote deletion and whether already downloaded reviews remain locally until explicitly removed.

## Revisions and corrections

The profile has a stable client-generated ID, monotonically increasing revision, `effectiveAt`, and `updatedAt`.

- Editing a goal or constraint creates a new revision rather than rewriting the context used by an earlier review.
- Reviews retain the profile revision they analyzed.
- Current explicit input outranks older profile revisions, inferred preferences, and external context.
- Marking a goal achieved, paused, or archived preserves its history.
- Goal changes do not retroactively judge earlier weeks against the new goal.
- Concurrent edits resolve during AIC-004/AIC-005 design; timestamp-only last-write-wins is not assumed sufficient for multi-field profile conflicts.

## Validation boundary

Validate the complete profile before local persistence or context assembly. Invalid goal targets, duplicate active priorities, invalid timezones, conflicting preferences, or enabled coaching without history consent must be rejected rather than silently repaired.
