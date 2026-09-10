import { test, expect, type Page } from '@playwright/test';
import { shift, todayKey } from '../src/lib/dates';
import AxeBuilder from '@axe-core/playwright';
import { offlineServer } from './offline-server';

async function onboard(page: Page, offset = 12, ongoing = false, url = '/') {
  await page.goto(url);
  await page.getByRole('button', { name: 'Let’s begin' }).click();
  await page.getByLabel('First bleeding day').fill(shift(todayKey(), -offset));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel(ongoing ? 'Not yet' : 'Yes', { exact: true }).check();
  if (!ongoing)
    await page.getByLabel('Last bleeding day').fill(shift(todayKey(), -offset + Math.min(4, offset)));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Yes, I have an idea').check();
  await page.getByRole('button', { name: 'Meet your cycle' }).click();
  await expect(page.getByRole('button', { name: 'Open today’s diary' })).toBeVisible();
  const ready = page.getByRole('button', { name: 'Got it', exact: true });
  if (await ready.isVisible()) await ready.click();
}

test('daily journey stays private, persists, exports and restores', async ({ page, context }) => {
  // Keep this persistence journey on one day even when the real run crosses midnight.
  // Midnight/resume behavior has its own date and useToday tests.
  await page.clock.setFixedTime(new Date());
  const outbound: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  context.on('request', (request) => {
    if (request.url().startsWith('http') && new URL(request.url()).origin !== 'http://127.0.0.1:4173')
      outbound.push(request.url());
    if (request.method() !== 'GET') outbound.push(`${request.method()} ${request.url()}`);
  });
  await onboard(page);
  await expect(page.getByRole('heading', { name: 'Fertile window', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open today’s diary' }).click();
  await page.getByLabel('How did today feel?').fill('Felt pretty good today.');
  await page.getByRole('button', { name: 'Energetic', exact: true }).click();
  await page.getByRole('button', { name: 'Bloating', exact: true }).click();
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await expect(page.getByText('Felt pretty good today.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log ovulation sign', exact: true }).click();
  await page.getByRole('button', { name: 'Cervical mucus change', exact: true }).click();
  await page.getByRole('button', { name: 'Save sign', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await page.getByLabel('Backup file').setInputFiles(path!);
  await expect(page.getByText('Backup ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Replace history with this backup' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Open today’s diary' }).click();
  await expect(page.getByLabel('How did today feel?')).toHaveValue('Felt pretty good today.');
  await page.getByLabel('How did today feel?').fill('A calm evening.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  expect(outbound).toEqual([]);
  expect(errors).toEqual([]);
});

test('period start, end, historical correction and deletion', async ({ page }) => {
  await onboard(page, 28);
  await page.getByRole('button', { name: 'My period started' }).click();
  await page.getByRole('button', { name: 'Save period' }).click();
  await expect(page.getByRole('button', { name: 'My period ended' })).toBeVisible();
  await page.getByRole('button', { name: 'My period ended' }).click();
  await page.getByRole('button', { name: 'Save period' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator('button[aria-current="date"]').click();
  await page.getByRole('button', { name: 'Edit period range' }).click();
  await page.getByLabel('First bleeding day').fill(shift(todayKey(), -1));
  await page.getByRole('button', { name: 'Save period' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('button[aria-current="date"]').click();
  await page.getByRole('button', { name: 'Edit period range' }).click();
  await page.getByRole('button', { name: 'Delete this period' }).click();
  await page.getByRole('button', { name: 'Yes, delete period' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('offline reload and diary, calendar, export and settings work', async ({ page }) => {
  const server = await offlineServer();
  await onboard(page, 12, false, server.url);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await server.stop();
  await page.reload();
  await page.getByRole('button', { name: 'Open today’s diary' }).click();
  await page.getByLabel('How did today feel?').fill('Written offline.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator('button[aria-current="date"]').click();
  await expect(page.getByText('Written offline.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  await download;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Make yourself at home' })).toBeVisible();
});

test('small through large viewports have no horizontal overflow', async ({ page }, testInfo) => {
  await onboard(page);
  for (const width of [320, 375, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    for (const tab of ['Home', 'Calendar', 'Insights', 'Settings']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.locator('.toast')).not.toBeVisible();
  const noteAction = await page.locator('.daily-prompt .text-button').boundingBox();
  const navigation = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  expect(noteAction!.y + noteAction!.height).toBeLessThanOrEqual(navigation!.y);
  await page.screenshot({
    path: `docs/screenshots/home-${testInfo.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.screenshot({
    path: `docs/screenshots/calendar-${testInfo.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Open today’s diary' }).click();
  await page.screenshot({
    path: `docs/screenshots/diary-${testInfo.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('core screens and diary satisfy automated accessibility checks', async ({ page }) => {
  await onboard(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const tab of ['Home', 'Calendar', 'Insights', 'Settings']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Open today’s diary' }).click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('manifest, icons, reduced motion and keyboard focus', async ({ page, request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await onboard(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Open today’s diary' }).click();
  await expect(page.getByLabel('How did today feel?')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open today’s diary' })).toBeFocused();
});

test('invalid backup cannot overwrite history', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await page.getByLabel('Backup file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"rayang","version":999}'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace history with this backup' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fertile window', exact: true })).toBeVisible();
});
