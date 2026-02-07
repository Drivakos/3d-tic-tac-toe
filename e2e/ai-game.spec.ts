import { test, expect } from '@playwright/test';

test.describe('AI Game', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('starts easy AI game with no timer', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        // First select timer (OFF for no timer)
        await page.waitForSelector('#ai-timer-select:not(.hidden)', { timeout: 10000 });
        await page.click('#ai-timer-buttons [data-timer="0"]');
        // Then select difficulty
        await page.waitForSelector('#difficulty-select:not(.hidden)', { timeout: 10000 });
        await page.click('[data-difficulty="easy"]');

        // Game should start - wait for game UI
        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await expect(page.locator('#ui-overlay')).toBeVisible();
        await expect(page.locator('#score-board')).toBeVisible();
    });

    test('starts medium AI game with 5s timer', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        // Select 5s timer
        await page.waitForSelector('#ai-timer-select:not(.hidden)', { timeout: 10000 });
        await page.click('#ai-timer-buttons [data-timer="5"]');
        // Select medium difficulty
        await page.waitForSelector('#difficulty-select:not(.hidden)', { timeout: 10000 });
        await page.click('[data-difficulty="medium"]');

        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await expect(page.locator('#ui-overlay')).toBeVisible();
    });

    test('starts hard AI game with 3s timer', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        // Select 3s timer
        await page.waitForSelector('#ai-timer-select:not(.hidden)', { timeout: 10000 });
        await page.click('#ai-timer-buttons [data-timer="3"]');
        // Select hard difficulty
        await page.waitForSelector('#difficulty-select:not(.hidden)', { timeout: 10000 });
        await page.click('[data-difficulty="hard"]');

        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await expect(page.locator('#ui-overlay')).toBeVisible();
    });

    test('can navigate back from difficulty to timer select', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await page.waitForSelector('#ai-timer-select:not(.hidden)', { timeout: 10000 });
        await page.click('#ai-timer-buttons [data-timer="10"]');

        await page.waitForSelector('#difficulty-select:not(.hidden)', { timeout: 10000 });
        // Click back button
        await page.click('#back-to-ai-timer');

        // Timer select should be visible again
        await expect(page.locator('#ai-timer-select')).toBeVisible({ timeout: 10000 });
    });

    test('can return to menu from AI game', async ({ page }) => {
        await page.click('[data-mode="ai"]');
        await page.waitForSelector('#ai-timer-select:not(.hidden)', { timeout: 10000 });
        await page.click('#ai-timer-buttons [data-timer="0"]');
        await page.waitForSelector('#difficulty-select:not(.hidden)', { timeout: 10000 });
        await page.click('[data-difficulty="easy"]');

        await page.waitForSelector('#ui-overlay:not(.hidden)', { timeout: 10000 });
        await page.click('#menu-btn');

        await expect(page.locator('[data-mode="ai"]')).toBeVisible({ timeout: 10000 });
    });
});
