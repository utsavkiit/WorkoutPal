import { CoachingProfileV1 } from './goals';
import { completedReviewPeriod } from './metrics';
import { CoachingGenerationRequestV1 } from './workflow';

export type WeeklyScheduleDecision =
  | { shouldRequest: true; periodStart: string; periodEnd: string }
  | { shouldRequest: false; reason: 'disabled' | 'consent_required' | 'already_requested'; periodStart: string | null; periodEnd: string | null };

export function weeklyScheduleDecision(
  profile: CoachingProfileV1 | null,
  requests: CoachingGenerationRequestV1[],
  at = new Date(),
): WeeklyScheduleDecision {
  if (!profile?.weeklyReview.enabled) return { shouldRequest: false, reason: 'disabled', periodStart: null, periodEnd: null };
  if (!profile.consent.coachingEnabled || !profile.consent.shareWorkoutHistory) {
    return { shouldRequest: false, reason: 'consent_required', periodStart: null, periodEnd: null };
  }

  const period = completedReviewPeriod(at, profile.weeklyReview.dayOfWeek, profile.weeklyReview.timezone);
  const duplicate = requests.some((request) =>
    request.context.metrics.period.startDate === period.startDate
    && request.context.metrics.period.endDate === period.endDate,
  );
  if (duplicate) return { shouldRequest: false, reason: 'already_requested', periodStart: period.startDate, periodEnd: period.endDate };
  return { shouldRequest: true, periodStart: period.startDate, periodEnd: period.endDate };
}
