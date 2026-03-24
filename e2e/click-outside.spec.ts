import { test, expect } from './test'

test.describe('onClickOutside', () => {
    test('should open and close dropdown by toggling', async ({ page }) => {
        const dropdown = page.locator('#dropdown')
        const status = page.locator('#click-outside-status')

        await expect(dropdown).toBeHidden()
        await expect(status).toHaveText('closed')

        await page.click('#toggle-dropdown')
        await expect(dropdown).toBeVisible()
        await expect(status).toHaveText('open')

        await page.click('#toggle-dropdown')
        await expect(dropdown).toBeHidden()
        await expect(status).toHaveText('closed')
    })

    test('should close dropdown when clicking outside', async ({ page }) => {
        const dropdown = page.locator('#dropdown')
        const status = page.locator('#click-outside-status')

        await page.click('#toggle-dropdown')
        await expect(dropdown).toBeVisible()

        // Click somewhere outside the dropdown and toggle button
        await page.click('h1')
        await expect(dropdown).toBeHidden()
        await expect(status).toHaveText('closed')
    })

    test('should not close dropdown when clicking inside it', async ({ page }) => {
        const dropdown = page.locator('#dropdown')

        await page.click('#toggle-dropdown')
        await expect(dropdown).toBeVisible()

        await page.click('#dropdown-action')
        await expect(dropdown).toBeVisible()
    })
})
