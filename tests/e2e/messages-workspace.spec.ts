import { expect, test, type Locator } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAIAAACwpMoFAAACU0lEQVR42u3cvVHEMBCGYfuDyiiAKkhIKYSUhCoogCKuiwuuBGYISJjhYLC9K31avZsxw9mSnltZf771dDkvRN0QTQAwATABMAEwATABMAEwwATABMAEwATAxJG4pQm2xs3bw/c/P+5fnUu7sl24m3YIZoCP0poz8wwO0930nwATAJulr2cSA0wGk75NPgUwATABMMAEwPlx9/LsUIx9K1NW61my1TUxJoMTc9fBeGs6ui1Huz+DyeNSwFc5uxv/PykNd5OMtgv/hnx/fFrYD16GPdExRFf8pciJjixghyTmGZyYvgy4hgTexIbxYMA7wDAeBng3Fcb1Nxswdgc+LoSxL3CUDcaOwLEqGNff8MfYCBiMysB5unxv+gNnG2DcE7hN62Nc/1Qlxh2AGzc6xk2BuzS3m3HH8qhqxXyM+54CTjzR4dDEfQ+B/GyB9uUp/uqKWxfSvjyapIf0uWnj8ogxTvvbtSyPmKXE1t3tAKHmaXq3W7Qx1jzpm1q2fRdv0FyaqnNOKuGRy2Y3Wtg8eKBHb+BkNKrWefNjTTiwMjwRlteAmna460aSZBzQRY87L9rXMabWN7yv1syzXsMXZ8Kvr8nXNAxffYu9C7+T5fjyauC9xJJk4AKkobHQtdr8Cb+10HX+gZ/jBRC6v1XNpKYHi8Eg6/r5Kavv8ZHCbFvo4ETqMtqyjNCtvbwqdGsb8wwubizSt7ax0K1tLHRrGwvd2sYMsoobi/StbSx0axsL3drGQre2MYOs4sYifWsbC93axkK3tjHP4OLG6+lyJn0LxycJsRlUqGooaAAAAABJRU5ErkJggg==', 'base64');

test('Messages supports images, mentions, bell links and an in-bounds reaction picker', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
  const task = '40000000-0000-4000-8000-000000000001';
  const projectChat = '90000000-0000-4000-8000-000000000001';
  const taskChat = '90000000-0000-4000-8000-000000000002';
  const directChat = '90000000-0000-4000-8000-000000000003';
  const incoming = '91000000-0000-4000-8000-000000000001';
  const messages: Array<Record<string, unknown>> = [{
    id: incoming, channel_id: projectChat, sender_id: 'member', sender_name: 'Alex Rivera',
    content: 'Is the venue ready?', created_at: '2026-11-09T03:00:00Z', pinned_at: null, reaction_users: {},
  }];
  let unread = true;
  let uploadedPath = '';
  let notificationRead = false;
  await page.route(/\/rest\/v1\/notifications(?:\?|$)/, route => {
    if (route.request().method() === 'PATCH') {
      notificationRead = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: [{
      id: '92000000-0000-4000-8000-000000000001', user_id: fixture.id, type: 'comment',
      title: 'You were mentioned', message: 'Alex Rivera mentioned you in Community outreach',
      conversation_id: projectChat, read: notificationRead, created_at: new Date().toISOString(),
    }] });
  });
  let releaseConversations!: () => void;
  const conversationsReady = new Promise<void>(resolve => { releaseConversations = resolve; });
  await page.route('**/rest/v1/rpc/list_message_conversations', async route => {
    await conversationsReady;
    await route.fulfill({ json: [
    { channel_id: projectChat, channel_type: 'project', project_id: fixture.project, name: 'Community outreach', unread,
      last_message: messages[messages.length - 1]?.content || 'Sent an image', last_message_at: '2026-11-09T03:00:00Z' },
    { channel_id: taskChat, channel_type: 'task', task_id: task, name: 'Book venue', project_title: 'Community outreach', unread: false },
    { channel_id: directChat, channel_type: 'direct', name: 'Alex Rivera', other_user_id: 'member', unread: false },
    ] });
  });
  await page.route('**/rest/v1/rpc/read_message_conversation', route => {
    expect(route.request().postDataJSON().p_channel).toBe(projectChat);
    unread = false;
    return route.fulfill({ json: null });
  });
  await page.route('**/rest/v1/rpc/list_message_people', route => route.fulfill({ json: [{ id: 'member', name: 'Alex Rivera', is_lead: false }] }));
  await page.route('**/rest/v1/rpc/set_conversation_message_pin', route => {
    expect(route.request().postDataJSON()).toEqual({ p_message: incoming, p_pin: true });
    messages[0].pinned_at = '2026-11-09T03:00:00Z';
    return route.fulfill({ json: null });
  });
  await page.route('**/rest/v1/rpc/toggle_conversation_reaction', route => {
    const short = messages.find(row => row.content === 'OK')!;
    expect(route.request().postDataJSON()).toEqual({ p_message: short.id, p_emoji: '😡' });
    short.reaction_users = { '😡': { [fixture.id]: 'Alex Rivera' } };
    return route.fulfill({ json: null });
  });
  await page.route(/\/rest\/v1\/chat_messages(?:\?|$)/, route => {
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON();
      expect(data.channel_id).toBe(projectChat);
      if (data.image_path) expect(data.image_path).toBe(uploadedPath);
      else if (data.content !== 'OK') expect(JSON.parse(data.content)).toEqual({
        text: '@Alex Rivera @everyone please review',
        mentions: [{ id: 'member', label: '@Alex Rivera', start: 0 }],
      });
      const sequence = messages.length + 1;
      messages.push({ ...data, id: '91000000-0000-4000-8000-00000000000' + sequence, created_at: '2026-11-09T03:1' + sequence + ':00Z', pinned_at: null, reaction_users: {} });
      return route.fulfill({ status: 201, json: null });
    }
    const query = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: messages.filter(row => 'eq.' + row.channel_id === query.get('channel_id') && (!query.has('pinned_at') || row.pinned_at)).reverse() });
  });
  await page.route('**/storage/v1/object/conversation-images/**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ body: png, contentType: 'image/png' });
    uploadedPath = new URL(route.request().url()).pathname.split('/conversation-images/')[1];
    return route.fulfill({ json: { Key: 'conversation-images/' + uploadedPath } });
  });
  await page.reload();
  const loading = page.getByRole('status', { name: 'Loading conversations' });
  try {
    await page.getByRole('button', { name: 'Open messages', exact: true }).click({ timeout: 30_000 });
    await expect(loading).toBeVisible();
    await loading.screenshot({ path: info.outputPath('conversation-list-loading.png'), animations: 'disabled' });
  } finally {
    releaseConversations();
  }
  const launcher = page.getByRole('button', { name: 'Open messages, 1 unread conversation', exact: true });
  await expect(launcher.locator('.messages-unread-dot')).toBeVisible({ timeout: 40_000 });
  await expect(page).toHaveURL(/\/messages\?page=Messages/);
  await expect(loading).toHaveCount(0);
  await page.getByRole('button', { name: 'Community outreach, unread', exact: true }).screenshot({ path: info.outputPath('conversation-loaded.png'), animations: 'disabled' });
  await expect(page.getByRole('dialog', { name: 'Messages' })).toHaveCount(0);
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Alex Rivera', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book venue', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Groups', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search conversations' }).fill('community');
  await expect(page.getByRole('button', { name: 'Book venue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Community outreach, unread', exact: true }).click();
  const thread = page.getByRole('region', { name: 'Conversation with Community outreach' });
  await expect(thread.getByText('Is the venue ready?', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open messages', exact: true }).locator('.messages-unread-dot')).toHaveCount(0);
  await thread.getByText('Is the venue ready?', { exact: true }).hover();
  await thread.getByRole('button', { name: 'More message actions' }).click();
  await thread.getByRole('button', { name: 'Pin message' }).click();
  await expect(thread.getByRole('button', { name: /1 pinned/ })).toBeVisible();
  await page.locator('input[type=file][aria-label="Choose an image"]').setInputFiles({ name: 'venue.png', mimeType: 'image/png', buffer: png });
  await expect(thread.getByAltText('Image ready to send')).toBeVisible();
  await thread.getByRole('button', { name: 'Send message' }).click();
  await expect(thread.getByAltText('Shared image')).toHaveJSProperty('naturalWidth', 160);
  const composer = thread.getByRole('textbox', { name: 'Message' });
  await composer.fill('@Alex');
  await expect(thread.getByRole('option', { name: 'Alex Rivera', exact: true })).toBeVisible();
  await composer.press('Enter');
  await expect(composer).toHaveValue('@Alex Rivera ');
  await composer.pressSequentially('@ev');
  await expect(thread.getByRole('option', { name: /@everyone/ })).toBeVisible();
  await composer.press('Enter');
  await composer.pressSequentially('please review');
  await composer.press('Enter');
  await expect(thread.locator('.messages-mention-text')).toHaveText(['@Alex Rivera', '@everyone']);
  await composer.fill('OK');
  await composer.press('Enter');
  const shortMessage = thread.locator('.messages-message').filter({ has: page.getByText('OK', { exact: true }) });
  const reactions = page.getByRole('dialog', { name: 'Choose an emoji reaction' });
  const checkPicker = async (row: Locator, react = false) => {
    await row.hover();
    await row.getByRole('button', { name: 'React to message' }).click();
    await expect(reactions.getByRole('button')).toHaveCount(6);
    await expect(reactions.getByRole('button', { name: 'React with 😡' })).toBeVisible();
    await expect.poll(async () => {
      const bounds = await thread.locator('.messages-history').boundingBox();
      const picker = await reactions.boundingBox();
      return Boolean(bounds && picker && picker.x >= bounds.x && picker.x + picker.width <= bounds.x + bounds.width
        && picker.y >= bounds.y && picker.y + picker.height <= bounds.y + bounds.height);
    }).toBe(true);
    if (react) await reactions.getByRole('button', { name: 'React with 😡' }).click();
    else await page.keyboard.press('Escape');
    await expect(reactions).toHaveCount(0);
  };
  await checkPicker(shortMessage, true);
  await expect(shortMessage.getByRole('button', { name: '😡 reactions' })).toHaveText('😡 1');
  await thread.getByRole('button', { name: 'Chat info', exact: true }).click();
  const chatInfo = page.getByRole('complementary', { name: 'Chat info' });
  await expect(chatInfo.getByRole('list', { name: 'Chat members' }).getByText('Alex Rivera', { exact: true })).toBeVisible();
  await expect(chatInfo.getByRole('button', { name: 'Open project', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('messages-desktop.png') });
  await page.setViewportSize({ width: 390, height: 850 });
  await chatInfo.getByRole('button', { name: 'Close chat info' }).click();
  await expect(thread.getByRole('button', { name: 'Back to conversations' })).toBeVisible();
  await checkPicker(shortMessage);
  await expect(page.getByRole('navigation', { name: 'Mobile primary navigation' }).locator('[aria-current="page"]')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('messages-mobile.png') });
  await thread.getByRole('button', { name: 'Back to conversations' }).click();
  await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
  await page.goto('/messages?page=Messages&chatTask=' + task);
  await expect(page.getByRole('region', { name: 'Conversation with Book venue' })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Open notifications', exact: true }).click();
  await page.getByRole('dialog', { name: 'Notifications' }).getByRole('button', { name: /You were mentioned.*Open conversation/ }).click();
  await expect(page).toHaveURL(new RegExp('conversation=' + projectChat));
  await expect(thread).toBeVisible();
  expect(notificationRead).toBe(true);
});
