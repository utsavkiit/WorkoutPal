import assert from 'node:assert/strict';
import test from 'node:test';
import { CoachReviewFeedbackV1, validateCoachReviewFeedback } from './feedback';

const feedback:CoachReviewFeedbackV1={feedbackVersion:1,id:'feedback',reviewId:'review',profileId:'profile',profileRevision:2,usefulness:'helpful',tone:'right',changedConstraints:'Only two training days next week.',createdAt:'2026-09-13T00:00:00.000Z',updatedAt:'2026-09-13T00:00:00.000Z'};
test('accepts bounded review feedback and changed constraints',()=>assert.equal(validateCoachReviewFeedback(feedback).ok,true));
test('rejects unsupported feedback values and oversized user text',()=>assert.equal(validateCoachReviewFeedback({...feedback,tone:'harsh',changedConstraints:'x'.repeat(501)}).ok,false));
