import { test, expect } from '@playwright/test';

test.describe('AI Game', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('starts easy AI game', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await page.click('[data-difficulty="easy"]');

        // Game should start - wait for game UI
        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await expect(page.locator('#ui-overlay')).toBeVisible();
        await expect(page.locator('#score-board')).toBeVisible();
    });

    test('starts medium AI game', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await page.click('[data-difficulty="medium"]');

        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await expect(page.locator('#ui-overlay')).toBeVisible();
    });

    test('starts hard AI game', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await page.click('[data-difficulty="hard"]');

        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await expect(page.locator('#ui-overlay')).toBeVisible();
    });

    test('can return to menu from AI game', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await page.click('[data-difficulty="easy"]');

        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await page.click('#menu-btn');

        await expect(page.locator('[data-mode="ai"]')).toBeVisible({ timeout: 10000 });
    });
});
