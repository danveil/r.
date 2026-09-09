import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { shift, todayKey } from '../src/lib/dates';
import { offlineServer } from './offline-server';

async function setupPrimary(page: Page, url = '/') {
  await page.goto(url);
  await page.getByRole('button', { name: 'Let’s begin' }).click();
  await page.getByLabel('First bleeding day').fill(shift(todayKey(), -12));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Yes', { exact: true }).check();
  await page.getByLabel('Last bleeding day').fill(shift(todayKey(), -8));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Yes, I have an idea').check();
  await page.getByRole('button', { name: 'Meet your cycle' }).click();
  await expect(page.getByRole('button', { name: 'Open today’s diary' })).toBeVisible();
  const ready = page.getByRole('button', { name: 'Got it', exact: true });
  if (await ready.isVisible()) await ready.click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}

test('partner PWA launches at root with its encrypted cache after the server shuts down', async ({
  page,
  browser,
}) => {
  const server = await offlineServer();
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await setupPrimary(page, server.url);
    const link = await inviteLink(page);
    const partner = await other.newPage();
    await partner.goto(link);
    await partner.getByRole('button', { name: 'Accept Partner View' }).click();
    await expect(partner.getByText('Cycle day 13', { exact: true })).toBeVisible();
    await partner.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await partner.reload();
    await expect.poll(() => partner.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const cachedUrls = await partner.evaluate(async () => {
      const entries = await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map((request) => request.url),
        ),
      );
      return entries.flat();
    });
    expect(cachedUrls.some((url) => url.includes('/api/') || url.includes('invite='))).toBe(false);
    await server.stop();
    await partner.goto(server.url);
    await expect(partner.getByText('Partner View · Read only', { exact: true })).toBeVisible();
    await expect(partner.getByText('Cycle day 13', { exact: true })).toBeVisible();
    await expect(partner.getByText(/Couldn’t connect/)).toBeVisible();
    await partner.getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(partner.locator('.calendar-day')).toHaveCount(42);
  } finally {
    await other.close();
    await server.stop();
  }
});
async function inviteLink(page: Page) {
  await page.getByRole('button', { name: 'Enable Partner Sharing', exact: true }).click();
  const consent = page.getByRole('button', { name: 'Confirm and create invitation' });
  await expect(consent).toBeDisabled();
  await page.getByLabel('Current cycle and phase', { exact: true }).check();
  await page.getByLabel('Period calendar and estimates', { exact: true }).check();
  await consent.click();
  await expect(page.getByRole('img', { name: /Partner invitation QR code/ })).toBeVisible();
  await page.getByText('Show equivalent pairing link', { exact: true }).click();
  const link = await page.getByLabel('Private pairing link', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  return link;
}

test('opt-in pairing, read-only calendar, cycle updates and confirmed revocation', async ({
  page,
  browser,
}, testInfo) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/partner/')) requests.push(r.postData() ?? '');
  });
  await setupPrimary(page);
  expect(requests).toHaveLength(0);
  const link = await inviteLink(page);
  expect(new URL(link).search).toBe('');
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const partner = await other.newPage();
    const errors: string[] = [];
    partner.on('pageerror', (e) => errors.push(e.message));
    await partner.goto(link);
    await expect(partner.getByRole('button', { name: 'Accept Partner View' })).toBeVisible();
    expect(new URL(partner.url()).hash).toBe('');
    await expect(partner.getByText('Fertility estimates', { exact: true })).toHaveCount(0);
    await partner.getByRole('button', { name: 'Accept Partner View' }).click();
    await expect(partner.getByText('Cycle day 13', { exact: true })).toBeVisible();
    await expect(
      partner.getByRole('button', { name: /diary|edit|export|import|log|period started/i }),
    ).toHaveCount(0);
    expect((await new AxeBuilder({ page: partner }).analyze()).violations).toEqual([]);
    await partner.getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(partner.locator('.calendar-day')).toHaveCount(42);
    await partner.locator('button[aria-current="date"]').click();
    await expect(partner.getByRole('dialog').getByText('Partner View is read-only.')).toBeVisible();
    await partner.getByRole('button', { name: 'Close', exact: true }).click();
    for (const width of [320, 390, 768]) {
      await partner.setViewportSize({ width, height: 844 });
      expect(await partner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await partner.setViewportSize({ width: 390, height: 844 });
    await partner.screenshot({ path: testInfo.outputPath('partner-calendar.png'), fullPage: true });
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.locator('button[aria-current="date"]').click();
    await page.getByRole('button', { name: 'Mark period started', exact: true }).click();
    await page.getByRole('button', { name: 'Save period', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Sync now', exact: true }).click();
    await expect(page.getByText('Active · Partner device', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync now', exact: true })).toBeEnabled();
    await partner.getByRole('button', { name: 'Refresh shared cycle', exact: true }).click();
    await partner.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(partner.getByText('Cycle day 1', { exact: true })).toBeVisible();
    await partner.screenshot({ path: testInfo.outputPath('partner-home.png'), fullPage: true });
    await page.getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm stop sharing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enable Partner Sharing', exact: true })).toBeVisible();
    await partner.getByRole('button', { name: 'Refresh shared cycle', exact: true }).click();
    await expect(
      partner.getByText('This partner connection is no longer active.', { exact: true }),
    ).toBeVisible();
    await expect(partner.getByText('Cycle day 1', { exact: true })).toHaveCount(0);
    await partner.reload();
    await expect(partner.getByRole('heading', { name: 'A shared rhythm' })).toBeVisible();
    expect(requests.join('')).not.toMatch(/cycleDay|permissions|diary|symptoms|startDate/);
    expect(errors).toEqual([]);
  } finally {
    await other.close();
  }
});

test('offline cached partner state, local disconnect, and pending primary stop are honest', async ({
  page,
  browser,
}) => {
  await setupPrimary(page);
  const link = await inviteLink(page);
  const other = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  try {
    const partner = await other.newPage();
    await partner.goto(link);
    await partner.getByRole('button', { name: 'Accept Partner View' }).click();
    await expect(partner.getByText('Cycle day 13', { exact: true })).toBeVisible();
    await other.route('**/api/partner/**', (route) => route.abort());
    await partner.reload();
    await expect(partner.getByText('Cycle day 13', { exact: true })).toBeVisible();
    await expect(partner.getByText(/Couldn’t connect/)).toBeVisible();
    await partner.getByRole('button', { name: 'Settings', exact: true }).click();
    await partner.getByRole('button', { name: 'Disconnect this device', exact: true }).click();
    await partner.getByRole('button', { name: 'Confirm disconnect', exact: true }).click();
    await expect(partner.getByText('This device is disconnected.', { exact: true })).toBeVisible();
    await page.route('**/api/partner/**', (route) => route.abort());
    await page.getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm stop sharing', exact: true }).click();
    await expect(page.getByRole('dialog').getByText(/Couldn’t connect/)).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByText('Stopping · waiting for confirmation', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync now', exact: true })).toBeDisabled();
    await page.unroute('**/api/partner/**');
    await page.getByRole('button', { name: 'Retry stopping', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm stop sharing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enable Partner Sharing', exact: true })).toBeVisible();
  } finally {
    await other.close();
  }
});
