import { standalone, closePartnerContext } from './partner-context';
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
    await standalone(other);
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
    await closePartnerContext(other);
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

test('Safari hands an unclaimed setup code to a completely fresh standalone app', async ({
  page,
  browser,
}, testInfo) => {
  await setupPrimary(page);
  const link = await inviteLink(page);
  const safari = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const installed = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const seen: string[] = [];
  const capture = (r: import('@playwright/test').Request) =>
    seen.push(r.url() + JSON.stringify(r.headers()) + (r.postData() ?? ''));
  safari.on('request', capture);
  installed.on('request', capture);
  try {
    await safari.addInitScript(() =>
      Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => false }),
    );
    // Clipboard API is mocked only to verify explicit user action; iOS clipboard permission is a physical check.
    await safari.addInitScript(() =>
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as Window & { copied?: string }).copied = value;
          },
        },
      }),
    );
    const browserPage = await safari.newPage();
    await browserPage.goto(link);
    await expect(
      browserPage.getByRole('heading', { name: 'Rayang works best from your Home Screen.' }),
    ).toBeVisible();
    await expect(browserPage.getByRole('button', { name: 'Accept Partner View' })).toHaveCount(0);
    expect(new URL(browserPage.url()).pathname).toBe('/');
    expect(new URL(browserPage.url()).hash).toBe('');
    expect(await browserPage.evaluate(() => (window as Window & { copied?: string }).copied)).toBeUndefined();
    await browserPage.getByRole('button', { name: 'Copy setup code', exact: true }).click();
    await expect(
      browserPage.getByText('Setup code copied. Keep it private until pairing is complete.'),
    ).toBeVisible();
    const code = await browserPage.evaluate(() => (window as Window & { copied?: string }).copied!);
    expect(code.startsWith('RAYANG1-')).toBe(true);
    const countPartner = () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('rayang-partner');
        request.onerror = () => reject(new Error('storage'));
        request.onsuccess = () => {
          const connection = request.result;
          const count = connection.transaction('partner').objectStore('partner').count();
          count.onsuccess = () => {
            resolve(count.result);
            connection.close();
          };
        };
      });
    expect(await browserPage.evaluate(countPartner)).toBe(0);
    expect((await new AxeBuilder({ page: browserPage }).analyze()).violations).toEqual([]);
    await browserPage.screenshot({ path: testInfo.outputPath('browser-handoff.png'), fullPage: true });
    await standalone(installed);
    const partner = await installed.newPage();
    await partner.goto(new URL(link).origin);
    expect(await partner.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(await partner.evaluate(countPartner)).toBe(0);
    await partner.getByRole('button', { name: 'I have a partner setup code', exact: true }).click();
    await partner.reload();
    await partner.getByLabel('Partner setup code', { exact: true }).fill(code);
    await partner.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(partner.getByRole('heading', { name: 'Shared with you', exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page: partner }).analyze()).violations).toEqual([]);
    await partner.getByRole('button', { name: 'Accept Partner View', exact: true }).click();
    await expect(partner.getByText('Cycle day 13', { exact: true })).toBeVisible();
    await partner.close();
    const reopened = await installed.newPage();
    await reopened.goto(new URL(link).origin);
    await expect(reopened.getByText('Cycle day 13', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.locator('button[aria-current="date"]').click();
    await page.getByRole('button', { name: 'Mark period started', exact: true }).click();
    await page.getByRole('button', { name: 'Save period', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Sync now', exact: true }).click();
    await expect(page.getByText('Active · Partner device', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync now', exact: true })).toBeEnabled();
    await reopened.getByRole('button', { name: 'Refresh shared cycle', exact: true }).click();
    await expect(reopened.getByText('Cycle day 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stop sharing', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm stop sharing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enable Partner Sharing', exact: true })).toBeVisible();
    await reopened.getByRole('button', { name: 'Refresh shared cycle', exact: true }).click();
    await expect(
      reopened.getByText('This partner connection is no longer active.', { exact: true }),
    ).toBeVisible();
    await reopened.getByRole('button', { name: 'I have a partner setup code', exact: true }).click();
    await reopened.getByLabel('Partner setup code', { exact: true }).fill(code);
    await reopened.getByRole('button', { name: 'Continue', exact: true }).click();
    await reopened.getByRole('button', { name: 'Accept Partner View', exact: true }).click();
    await expect(
      reopened.getByText('This partner connection is no longer available.', { exact: true }),
    ).toBeVisible();
    const secret = JSON.parse(Buffer.from(new URL(link).hash.slice(8), 'base64url').toString()).key;
    for (const request of seen) {
      expect(request).not.toContain(code);
      expect(request).not.toContain(secret);
      expect(request).not.toContain('#invite=');
    }
    expect(seen.filter((r) => r.includes('"operation":"accept"')).length).toBe(1);
  } finally {
    try {
      await closePartnerContext(safari);
    } finally {
      await closePartnerContext(installed);
    }
  }
});

test('standalone invalid setup is local, safely labeled and accepts paste', async ({ page, context }) => {
  await standalone(context);
  const requests: string[] = [];
  context.on('request', (r) => {
    if (r.url().includes('/api/')) requests.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'I have a partner setup code', exact: true }).click();
  await page.getByLabel('Partner setup code', { exact: true }).fill('RAYANG1-not-a-valid-code');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.getByText("This setup code isn't valid. Ask your partner to create a new invitation.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('an existing primary PWA requires acknowledgment and keeps its data when opening Partner View', async ({
  page,
  context,
}) => {
  await standalone(context);
  await setupPrimary(page);
  const link = await inviteLink(page);
  const readPrimary = () =>
    new Promise<string>((resolve, reject) => {
      const request = indexedDB.open('rayang-private');
      request.onerror = () => reject(new Error('storage'));
      request.onsuccess = () => {
        const connection = request.result;
        const tx = connection.transaction(Array.from(connection.objectStoreNames));
        const result: Record<string, unknown> = {};
        for (const name of Array.from(connection.objectStoreNames)) {
          const get = tx.objectStore(name).getAll();
          get.onsuccess = () => {
            result[name] = get.result;
          };
        }
        tx.oncomplete = () => {
          connection.close();
          resolve(JSON.stringify(result));
        };
      };
    });
  const before = await page.evaluate(readPrimary);
  await page.getByRole('button', { name: 'Set up Partner View on this device', exact: true }).click();
  await expect(page.getByLabel('Partner setup code', { exact: true })).toBeVisible();
  await page.goto(link);
  const accept = page.getByRole('button', { name: 'Accept Partner View', exact: true });
  await expect(page.getByText(/Your own cycle history is already on this device/)).toBeVisible();
  await expect(accept).toBeDisabled();
  await page.getByLabel('Keep my history and open Partner View', { exact: true }).check();
  await accept.click();
  await expect(page.getByText('Cycle day 13', { exact: true })).toBeVisible();
  expect(await page.evaluate(readPrimary)).toBe(before);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Return to my cycle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open today’s diary' })).toBeVisible();
  expect(await page.evaluate(readPrimary)).toBe(before);
});

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
    await standalone(other);
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
    await closePartnerContext(other);
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
    await standalone(other);
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
    await closePartnerContext(other);
  }
});
