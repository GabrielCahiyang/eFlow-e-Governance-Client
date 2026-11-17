import { expect, test } from '@playwright/test';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
for (const width of [1440, 390]) test(`notification filters, older pages and new arrivals at ${width}px`, async ({ page }, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let failReads = false;
  const rows = Array.from({ length: 63 }, (_, index) => {
    const n = 63 - index;
    return { id: id(n), user_id: id(90), type: n <= 3 ? 'approval_needed' : ['assignment', 'comment', 'status_change'][n % 3],
      title: n <= 3 ? `Your review is needed ${n}` : `Task update ${n}`, message: 'Chris updated the venue arrangements for your service activity.',
      reason: n <= 3 ? 'Please confirm the accessible entrance before proceeding.' : 'Due date: 20 Nov 2026 → 24 Nov 2026',
      task_title: 'Community outreach and visitor arrangements', actor_name: 'Chris', read: n <= 3 ? false : n % 3 === 0,
      created_at: new Date(Date.parse('2026-11-17T00:00:00Z') + n * 60000).toISOString() };
  });
  await page.routeWebSocket(/\/realtime\//, socket => socket.close());
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (!url.pathname.endsWith('/rest/v1/notifications')) return route.abort();
    if (route.request().method() === 'PATCH') {
      const exactId = url.searchParams.get('id')?.replace('eq.', '');
      rows.forEach(row => { if (!exactId || row.id === exactId) row.read = true; });
      if (!exactId) rows.unshift({ ...rows[0], id: id(100), title: 'A new schedule change', type: 'status_change', read: false, created_at: '2026-11-17T02:00:00.000Z' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(exactId ? [{ id: exactId }] : []) });
    }
    // A non-retryable read failure makes the recovery state deterministic;
    // transport retries are covered independently in the subscription tests.
    if (failReads) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary failure' }) });
    let selected = [...rows];
    if (url.searchParams.get('read') === 'eq.false') selected = selected.filter(row => !row.read);
    const types = url.searchParams.get('type');
    if (types) selected = selected.filter(row => types.includes(row.type));
    for (const filter of url.searchParams.getAll('or')) {
      if (filter.includes('approval_needed')) selected = selected.filter(row => ['approval_needed', 'completed'].includes(row.type));
      const cursor = filter.match(/created_at\.lt\.([^,]+)/)?.[1];
      const cursorId = filter.match(/id\.lt\.([\da-f-]+)/)?.[1];
      if (cursor) selected = selected.filter(row => row.created_at < cursor || row.created_at === cursor && row.id < (cursorId || ''));
    }
    const since = url.searchParams.get('created_at')?.replace('gte.', '');
    if (since) selected = selected.filter(row => row.created_at >= since);
    const total = selected.length;
    selected = selected.slice(0, Number(url.searchParams.get('limit') || 1000));
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, selected.length - 1)}/${total}`, 'access-control-expose-headers': 'content-range' }, body: route.request().method() === 'HEAD' ? '' : JSON.stringify(selected) });
  });
  await page.goto('/tests/e2e/fixtures/notificationInbox.html');
  const feed = page.getByRole('region', { name: 'Notifications', exact: true });
  await expect(feed.getByText('Task update 63', { exact: true })).toBeVisible();
  await expect(feed.locator('li')).toHaveCount(25);
  await feed.getByRole('button', { name: 'Load older notifications' }).click();
  await expect(feed.locator('li')).toHaveCount(50);
  await page.getByLabel('Activity type').selectOption('reviews');
  await expect(feed.getByText('Your review is needed 1')).toBeVisible();
  await expect(feed.locator('li')).toHaveCount(3);
  await expect(feed).toContainText('Please confirm the accessible entrance before proceeding.');
  await page.getByLabel('Time period').selectOption('7');
  await feed.getByRole('tab', { name: /Unread/ }).click();
  await expect(feed.locator('li')).toHaveCount(3);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch theme' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`notifications-${theme}-${width}.png`), fullPage: true });
  }
  await feed.getByRole('button', { name: 'Clear filters' }).click();
  await expect(feed.locator('li')).toHaveCount(25);
  failReads = true;
  await feed.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(feed).toContainText('Notifications could not refresh');
  await expect(feed.locator('li')).toHaveCount(25);
  failReads = false;
  await feed.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(feed.getByText('Notifications could not refresh')).toHaveCount(0);
  await feed.getByRole('button', { name: 'Mark all read' }).click();
  await expect(feed.getByText('A new schedule change', { exact: true })).toBeVisible();
  await feed.getByRole('tab', { name: /Unread/ }).click();
  await expect(feed.locator('li')).toHaveCount(1);
  await expect(feed).toContainText('A new schedule change');
});
