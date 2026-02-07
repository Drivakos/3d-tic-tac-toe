import { test, expect } from '@playwright/test';

test.describe('Menu Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for page to fully load
        await page.waitForLoadState('networkidle');
    });

    test('shows mode selection screen on load', async ({ page }) => {
        // Check the mode overlay is present and buttons exist
        const pvpButton = page.locator('[data-mode="pvp"]');
        const aiButton = page.locator('[data-mode="ai"]');

        await expect(pvpButton).toBeVisible({ timeout: 10000 });
        await expect(aiButton).toBeVisible({ timeout: 10000 });
    });

    test('navigating to 2 Players shows PVP type selection', async ({ page }) => {
        await page.click('[data-mode="pvp"]');
        await expect(page.locator('#pvp-type-select')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-pvp-type="local"]')).toBeVisible();
        await expect(page.locator('[data-pvp-type="remote"]')).toBeVisible();
    });

    test('navigating to VS Computer shows AI timer selection', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        // Now shows timer selection first
        await expect(page.locator('#ai-timer-select')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#ai-timer-buttons [data-timer="0"]')).toBeVisible();
        await expect(page.locator('#ai-timer-buttons [data-timer="10"]')).toBeVisible();
    });

    test('can navigate from AI timer to difficulty selection', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await expect(page.locator('#ai-timer-select')).toBeVisible({ timeout: 10000 });

        // Select a timer
        await page.click('#ai-timer-buttons [data-timer="5"]');

        // Difficulty selection should now be visible
        await expect(page.locator('#difficulty-select')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-difficulty="easy"]')).toBeVisible();
        await expect(page.locator('[data-difficulty="medium"]')).toBeVisible();
        await expect(page.locator('[data-difficulty="hard"]')).toBeVisible();
    });

    test('can navigate back from local PVP timer selection', async ({ page }) => {
        await page.click('[data-mode="pvp"]');
        await expect(page.locator('#pvp-type-select')).toBeVisible({ timeout: 10000 });

        // Navigate to local timer selection
        await page.click('[data-pvp-type="local"]');
        await expect(page.locator('#timer-select')).toBeVisible({ timeout: 10000 });

        // Click back
        await page.click('#back-to-pvp-type-from-timer');
        await expect(page.locator('#pvp-type-select')).toBeVisible({ timeout: 10000 });
    });

    test('can navigate back from remote PVP timer selection', async ({ page }) => {
        await page.click('[data-mode="pvp"]');
        await expect(page.locator('#pvp-type-select')).toBeVisible({ timeout: 10000 });

        // Navigate to remote timer selection
        await page.click('[data-pvp-type="remote"]');
        await expect(page.locator('#remote-timer-select')).toBeVisible({ timeout: 10000 });

        // Click back
        await page.click('#back-to-pvp-type-from-remote-timer');
        await expect(page.locator('#pvp-type-select')).toBeVisible({ timeout: 10000 });
    });

    test('can navigate back from AI timer selection to mode select', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await expect(page.locator('#ai-timer-select')).toBeVisible({ timeout: 10000 });

        // Click back
        await page.click('#back-to-mode-from-ai-timer');
        await expect(page.locator('#mode-buttons')).toBeVisible({ timeout: 10000 });
    });
});
