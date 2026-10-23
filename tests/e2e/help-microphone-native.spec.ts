import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

// launchOptions is worker-scoped and must be configured at file level.
test.use({ permissions: ['microphone'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${resolve('tests/e2e/fixtures/help-microphone.wav')}`] } });
test('the real browser microphone graph updates the draft before recording stops', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Chromium synthetic microphone launch flags');
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const state = window as unknown as { qaCapture: Record<string, string> };
    state.qaCapture = {};
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = options => {
      state.qaCapture.permission = 'pending';
      return capture(options).then(stream => { state.qaCapture.permission = 'resolved'; return stream; }, error => { state.qaCapture.permission = String(error); throw error; });
    };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor() {
        super();
        const resume = this.resume.bind(this);
        this.resume = () => { state.qaCapture.resume = 'pending'; return resume().then(() => { state.qaCapture.resume = this.state; }); };
        const add = this.audioWorklet.addModule.bind(this.audioWorklet);
        this.audioWorklet.addModule = (url, options) => { state.qaCapture.worklet = 'pending'; return add(url, options).then(() => { state.qaCapture.worklet = 'resolved'; }); };
      }
    };
  });
  await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
  let count = 0, chatCalls = 0;
  await page.route(/\/controlpanelEflow\/api\/help-assistant\//, async route => {
    const operation = new URL(route.request().url()).pathname.split('/').at(-1);
    if (operation === 'projects') return route.fulfill({ json: { projects: [] } });
    if (operation === 'status') return route.fulfill({ json: { speechInstalled: true, readOnly: true } });
    if (operation === 'transcribe') { count++; return route.fulfill({ json: { text: count === 1 ? 'Open the project' : 'Open the project table.' } }); }
    if (operation === 'chat') chatCalls++;
    return route.fulfill({ status: 503, json: { detail: 'This fixture only checks capture and dictation.' } });
  });
  await page.getByRole('button', { name: 'Open help', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Talk to eFlow AI', exact: true }).click();
  const dialog = page.getByRole('dialog'), draft = dialog.getByRole('textbox', { name: 'Ask eFlow AI' });
  await dialog.getByRole('button', { name: 'Dictate question' }).click();
  try { await expect(draft).toHaveValue('Open the project', { timeout: 20000 }); }
  catch (error) {
    await info.attach('synthetic-capture-stages', { body: JSON.stringify(await page.evaluate(() => (window as unknown as { qaCapture: Record<string, string> }).qaCapture)), contentType: 'application/json' });
    throw error;
  }
  await expect(dialog.getByRole('button', { name: 'Finish dictation' })).toBeVisible();
  await expect(dialog.getByText('Hearing speech', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Send question' })).toBeDisabled();
  expect(chatCalls).toBe(0);
  await page.screenshot({ path: info.outputPath('native-audio-progressive.png') });
  await dialog.getByRole('button', { name: 'Finish dictation' }).click();
  await expect(draft).toHaveValue('Open the project table.');
  await expect(dialog.getByRole('button', { name: 'Send question' })).toBeEnabled();
  expect(chatCalls).toBe(0);
});
