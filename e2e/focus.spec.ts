import { test, expect } from './test'

test.describe('focusFirstEnabledElement', () => {
    test('focuses the first enabled candidate and returns true', async ({ page }) => {
        await page.click('#focus-enabled-btn')

        await expect(page.locator('#focus-result')).toHaveText('true')
        await expect(page.locator('#active-id')).toHaveText('enabled-second')
    })

    test('returns false when every candidate is missing or disabled', async ({ page }) => {
        await page.click('#focus-none-btn')

        await expect(page.locator('#focus-result')).toHaveText('false')
        await expect(page.locator('#active-id')).toHaveText('focus-none-btn')
    })
})
