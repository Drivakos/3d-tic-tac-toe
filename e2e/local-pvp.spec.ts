import { test, expect } from '@playwright/test';

test.describe('Local PvP Game', () => {
    test.setTimeout(120000); // Allow 2 minutes for slow environments

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Navigate to local PvP game
        await page.click('[data-mode="pvp"]');

        // Wait for PvP type selection and click Local
        await page.waitForSelector('#pvp-type-select:not(.hidden)');
        await page.click('[data-pvp-type="local"]');

        // Wait for timer selection and select OFF (no timer)
        await page.waitForSelector('#timer-select:not(.hidden)', { timeout: 10000 });
        await page.click('#timer-buttons [data-timer="0"]');

        // Wait for game UI to appear
        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 60000 });
    });

    test('starts game and shows game UI', async ({ page }) => {
        // Confirm mode overlay is hidden
        await expect(page.locator('#mode-select-overlay')).toHaveClass(/hidden/);

        // Game UI should be visible
        await expect(page.locator('#ui-overlay')).toBeVisible();
        await expect(page.locator('#score-board')).toBeVisible();
        await expect(page.locator('#reset-btn')).toBeVisible();
    });

    test('can click reset to start new game', async ({ page }) => {
        await expect(page.locator('#reset-btn')).toBeVisible();
        await page.click('#reset-btn');
        // Game UI should still be visible
        await expect(page.locator('#ui-overlay')).toBeVisible();
    });

    test('can return to main menu', async ({ page }) => {
        await page.click('#menu-btn');
        // Mode select should be visible again
        await expect(page.locator('#mode-select-overlay')).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Local PvP with Timer', () => {
    test('starts game with 10s timer', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.click('[data-mode="pvp"]');
        await page.waitForSelector('#pvp-type-select:not(.hidden)');
        await page.click('[data-pvp-type="local"]');

        // Select 10s timer
        await page.waitForSelector('#timer-select:not(.hidden)', { timeout: 10000 });
        await page.click('#timer-buttons [data-timer="10"]');

        // Game should start with timer
        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 60000 });
        await expect(page.locator('#ui-overlay')).toBeVisible();
    });
});
