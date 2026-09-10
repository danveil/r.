import type { BrowserContext } from '@playwright/test';
export async function standalone(context: BrowserContext) {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true }),
  );
}
// Closing auxiliary pages first avoids leaving outstanding navigations during WebKit context teardown.
// Failures are propagated, never converted to a passing test or hidden by a larger timeout.
export async function closePartnerContext(context: BrowserContext) {
  try {
    await Promise.all(context.pages().map((page) => page.close({ runBeforeUnload: false })));
  } finally {
    await context.close();
  }
}
