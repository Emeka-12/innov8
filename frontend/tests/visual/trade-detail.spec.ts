/**
 * Visual regression tests — Trade Detail page (/trades/[id]).
 *
 * Covers two trade states:
 *  1. An active / funded trade (buyer perspective)
 *  2. A completed / settled trade
 *
 * Both tests use the shared `authenticatedPage` fixture from fixtures.ts, which:
 *  - Freezes Date to 2026-03-01T12:00:00.000Z (deterministic timestamps)
 *  - Disables CSS animations/transitions
 *  - Seeds a JWT + Freighter mock (no real wallet needed)
 *  - Mocks all API routes with stable fixture data
 *
 * The `mockApiRoutes()` helper in fixtures.ts already stubs
 * GET /trades/TRD-FIXTURE-0001 → FIXTURES.trades[0] (active).
 * We add an extra route override inside each test for the second fixture trade.
 *
 * Updating baselines
 * ------------------
 * Run from the frontend/ directory:
 *   pnpm test:visual:update -- --grep "Trade Detail"
 * Commit the updated PNG files in the same PR as the visual change.
 * See tests/visual/SNAPSHOT_POLICY.md for the full procedure.
 */

import { test, expect, FIXTURES } from './fixtures';

const API = 'http://localhost:4000';

async function waitForStable(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // Allow one RAF cycle for any post-load paint to settle.
  await page.waitForTimeout(150);
}

// ── Active / funded trade ─────────────────────────────────────────────────────

test.describe('Trade Detail — active trade', () => {
  test('main panel matches snapshot', async ({ authenticatedPage: page }) => {
    // FIXTURES.trades[0] (active) is already mocked by mockApiRoutes().
    await page.goto(`/trades/${FIXTURES.tradeId}`);
    await waitForStable(page);

    const main = page.locator('main');
    await expect(main).toHaveScreenshot('trade-detail-active-main.png');
  });

  test('info cards row matches snapshot', async ({ authenticatedPage: page }) => {
    await page.goto(`/trades/${FIXTURES.tradeId}`);
    await waitForStable(page);

    // Target the grid of InfoCard tiles that shows Amount, Buyer, Seller.
    const cards = page.locator('[data-testid="trade-info-cards"], main .grid').first();
    await expect(cards).toHaveScreenshot('trade-detail-active-cards.png');
  });
});

// ── Completed / settled trade ─────────────────────────────────────────────────

test.describe('Trade Detail — settled trade', () => {
  const SETTLED_TRADE_ID = 'TRD-FIXTURE-0002';

  test('main panel matches snapshot', async ({ authenticatedPage: page }) => {
    // Override the single-trade route to return the settled fixture.
    await page.route(`${API}/trades/${SETTLED_TRADE_ID}`, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tradeId: SETTLED_TRADE_ID,
          buyerAddress: FIXTURES.walletAddress,
          sellerAddress: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC003',
          amountCngn: '12000',
          amountUsdc: '12000',
          status: 'completed',
          buyerLossBps: 5000,
          sellerLossBps: 5000,
          createdAt: '2026-01-10T08:00:00.000Z',
          updatedAt: '2026-01-12T14:30:00.000Z',
        }),
      }),
    );

    await page.goto(`/trades/${SETTLED_TRADE_ID}`);
    await waitForStable(page);

    const main = page.locator('main');
    await expect(main).toHaveScreenshot('trade-detail-settled-main.png');
  });
});

// ── Unauthenticated redirect ──────────────────────────────────────────────────

test.describe('Trade Detail — unauthenticated', () => {
  test('redirects or shows access-denied state', async ({ publicPage: page }) => {
    await page.goto(`/trades/${FIXTURES.tradeId}`);
    // Wait for either a redirect or the page to settle.
    await page
      .waitForURL(/(login|access-denied|trades)/, { timeout: 5_000 })
      .catch(() => {});
    await waitForStable(page);

    const body = page.locator('body');
    await expect(body).toHaveScreenshot('trade-detail-unauthenticated.png');
  });
});
