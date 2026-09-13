export const COACHING_FEEDBACK_VERSION = 1 as const;
export type CoachUsefulness = 'helpful' | 'not_helpful';
export type CoachTone = 'too_gentle' | 'right' | 'too_direct';

export interface CoachReviewFeedbackV1 {
  feedbackVersion: typeof COACHING_FEEDBACK_VERSION;
  id: string;
  reviewId: string;
  profileId: string;
  profileRevision: number;
  usefulness: CoachUsefulness;
  tone: CoachTone;
  changedConstraints: string | null;
  createdAt: string;
  updatedAt: string;
}

export function validateCoachReviewFeedback(value: unknown): { ok: true; value: CoachReviewFeedbackV1 } | { ok: false; errors: string[] } {
  const errors: string[]=[];
  if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,errors:['Feedback must be an object.']};
  const input=value as Partial<CoachReviewFeedbackV1>;
  if(input.feedbackVersion!==COACHING_FEEDBACK_VERSION)errors.push(`feedbackVersion must be ${COACHING_FEEDBACK_VERSION}.`);
  for(const key of ['id','reviewId','profileId'] as const)if(typeof input[key]!=='string'||!input[key]!.trim())errors.push(`${key} is required.`);
  if(!Number.isInteger(input.profileRevision)||(input.profileRevision??0)<1)errors.push('profileRevision must be positive.');
  if(!['helpful','not_helpful'].includes(input.usefulness??''))errors.push('usefulness is invalid.');
  if(!['too_gentle','right','too_direct'].includes(input.tone??''))errors.push('tone is invalid.');
  if(input.changedConstraints!==null&&(typeof input.changedConstraints!=='string'||!input.changedConstraints.trim()||input.changedConstraints.length>500))errors.push('changedConstraints must be non-empty, at most 500 characters, or null.');
  for(const key of ['createdAt','updatedAt'] as const)if(typeof input[key]!=='string'||Number.isNaN(Date.parse(input[key]!)))errors.push(`${key} must be an ISO timestamp.`);
  return errors.length?{ok:false,errors}:{ok:true,value:input as CoachReviewFeedbackV1};
}
