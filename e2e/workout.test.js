const { device, element, by, expect, waitFor } = require('detox');

const visible = async (target) => waitFor(target).toBeVisible().withTimeout(15000);

async function launch() {
  await device.launchApp({ newInstance: true, permissions: { notifications: 'NO' } });
  await visible(element(by.text('Ready to train?')));
}

async function startAndLogSet() {
  await element(by.text('Start an empty workout')).tap();
  await element(by.text('Add exercise')).tap();
  await element(by.id('exercise-search')).replaceText('Barbell Bench Press');
  await element(by.text('Barbell Bench Press')).tap();
  await element(by.label('Set 1 weight')).replaceText('135');
  await element(by.label('Set 1 reps')).replaceText('8');
  await element(by.label('Complete set')).atIndex(0).tap();
  await visible(element(by.label('Mark set incomplete')));
  await element(by.text('Skip')).tap();
}

async function openHistory(name = 'Quick Workout') {
  await visible(element(by.text(name)));
  await element(by.text(name)).tap();
  await visible(element(by.text('Workout details')));
}

async function assertLoggedSet(weight = '135 lb', reps = '8') {
  await expect(element(by.text('Barbell Bench Press'))).toBeVisible();
  await expect(element(by.text(weight))).toBeVisible();
  await expect(element(by.text(reps))).toBeVisible();
}

describe('Local workout persistence', () => {
  beforeEach(async () => {
    // Reinstall clears only this simulator app's sandbox, including SQLite.
    await device.uninstallApp();
    await device.installApp();
    await launch();
  });

  it('logs a set, finishes, and preserves history after process restart', async () => {
    await startAndLogSet();
    await element(by.id('finish-workout')).tap();
    await openHistory();
    await assertLoggedSet();
    await device.terminateApp();
    await launch();
    await expect(element(by.id('resume-workout'))).not.toExist();
    await openHistory();
    await assertLoggedSet();
  });

  it('recovers an active workout and saves history corrections across restart', async () => {
    await startAndLogSet();
    await device.terminateApp();
    await launch();
    await element(by.id('resume-workout')).tap();
    await expect(element(by.label('Set 1 weight'))).toHaveText('135');
    await expect(element(by.label('Set 1 reps'))).toHaveText('8');
    await expect(element(by.label('Mark set incomplete'))).toBeVisible();
    await element(by.id('finish-workout')).tap();
    await openHistory();
    await element(by.label('Edit')).tap();
    await element(by.label('Workout name')).replaceText('Discard this edit');
    await element(by.label('Cancel edit')).tap();
    await expect(element(by.text('Quick Workout'))).toBeVisible();
    await expect(element(by.text('Discard this edit'))).not.toExist();
    await element(by.label('Edit')).tap();
    await element(by.label('Workout name')).replaceText('E2E corrected workout');
    await element(by.label('Barbell Bench Press set 1 weight')).replaceText('140');
    await element(by.label('Barbell Bench Press set 1 reps')).replaceText('10');
    await element(by.label('Save')).tap();
    await visible(element(by.text('Workout details')));
    await assertLoggedSet('140 lb', '10');
    await device.terminateApp();
    await launch();
    await openHistory('E2E corrected workout');
    await assertLoggedSet('140 lb', '10');
  });
});
