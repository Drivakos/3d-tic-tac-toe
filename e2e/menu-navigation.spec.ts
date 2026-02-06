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

    test('navigating to VS Computer shows difficulty selection', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await expect(page.locator('#difficulty-select')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-difficulty="easy"]')).toBeVisible();
    });

    test('can navigate back from PVP type selection', async ({ page }) => {
        await page.click('[data-mode="pvp"]');
        await expect(page.locator('#pvp-type-select')).toBeVisible({ timeout: 10000 });

        // Navigate to local timer selection
        await page.click('[data-pvp-type="local"]');
        await expect(page.locator('#timer-select')).toBeVisible({ timeout: 10000 });

        // Click back
        await page.click('#back-to-pvp-type-from-timer');
        await expect(page.locator('#pvp-type-select')).toBeVisible({ timeout: 10000 });
    });
});
