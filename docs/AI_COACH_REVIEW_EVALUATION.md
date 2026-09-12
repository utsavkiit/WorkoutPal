# AI Coach weekly-review evaluation

Use this rubric for manual prompt/model evaluations beginning with AIC-002. Contract validation is necessary but does not establish coaching quality.

## Representative journeys

The executable fixtures in `src/coaching/fixtures.ts` cover:

1. steady, measurable progress where the current plan should be preserved;
2. an apparent plateau that is actually a small, noisy sample;
3. inconsistent weeks under a variable schedule;
4. returning after a training break; and
5. maintaining performance under a tighter session-time constraint.

These are synthetic records, not claims about a real user. Each fixture includes the context available to the agent, one expected contract-valid review, and explicit behavior to recognize and avoid.

## Proposed minimum usable data

Generate a `weekly_review` when the review period contains at least one completed workout and the supplied history contains enough context for at least one grounded comparison: a comparable prior workout, an explicit intended schedule, or an established goal baseline.

Otherwise generate a `continuity_check_in`. It may describe missing data and provide one manageable next step, but it must not fabricate a performance trend, claim an unlogged workout was missed, or repeat an old review as if it were new.

This threshold is provisional until tested against real histories during AIC-007/AIC-008.

## Rubric

Score each dimension 0–2:

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Evidence accuracy | Unsupported or contradicted claim | Mostly supported but imprecise | Every material claim is supported and precisely framed |
| Goal relevance | Generic or conflicts with goal | Related but not prioritized | Clearly interprets evidence against the stated goal |
| Motivation quality | Guilt, empty praise, or pressure | Neutral but not useful | Specific earned encouragement that protects continuity |
| Next-step quality | Unsafe, vague, or unrealistic | Plausible but broad | One clear, achievable step justified by evidence/constraints |
| Uncertainty | Hides limitations or overstates confidence | Mentions some limitations | Confidence and missing data materially shape the conclusion |
| Restraint | Invents changes or overreacts | Some unnecessary advice | Preserves what works and avoids reacting to normal noise |

Pass threshold: at least 10/12, with no zero in evidence accuracy, motivation quality, next-step quality, or uncertainty. Contract-invalid output always fails regardless of score.

## Repetition check

Evaluate at least four sequential reviews for the same synthetic journey before accepting a prompt/model version. Fail when headlines, highlights, or next steps are repeated without new evidence, or when the coach manufactures novelty merely to sound different.

## AIC-002 baseline assessment

The five authored expected outputs pass contract validation and cite only workout IDs present in their fixture context. They establish the intended output shape and tone; they do not validate any external model because no model run has occurred yet.
