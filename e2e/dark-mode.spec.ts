import { test, expect } from './test'

test.describe('prefersDarkMode', () => {
    test('class strategy returns false without dark class', async ({ page }) => {
        await expect(page.locator('#dark-class-off')).toHaveText('false')
    })

    test('class strategy returns true with dark class', async ({ page }) => {
        await expect(page.locator('#dark-class-on')).toHaveText('true')
    })

    test('media strategy returns a boolean', async ({ page }) => {
        const text = await page.locator('#dark-media').textContent()
        expect(['true', 'false']).toContain(text)
    })

    test('custom function returning true', async ({ page }) => {
        await expect(page.locator('#dark-custom-true')).toHaveText('true')
    })

    test('custom function returning false', async ({ page }) => {
        await expect(page.locator('#dark-custom-false')).toHaveText('false')
    })

    test('auto strategy without dark class returns false in light mode', async ({ page }) => {
        // Emulate light color scheme to make this deterministic
        await page.emulateMedia({ colorScheme: 'light' })
        await page.reload()
        await expect(page.locator('#dark-auto')).toHaveText('false')
    })
})
