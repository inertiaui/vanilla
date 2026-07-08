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
        await page.click('#toggle-dropdown')
        await expect(page.locator('#dropdown')).toBeVisible()

        await page.click('h1')
        await expect(page.locator('#dropdown')).toBeHidden()
        await expect(page.locator('#click-outside-status')).toHaveText('closed')
    })

    test('should not close dropdown when clicking inside it', async ({ page }) => {
        await page.click('#toggle-dropdown')
        await expect(page.locator('#dropdown')).toBeVisible()

        await page.click('#dropdown-action')
        await expect(page.locator('#dropdown')).toBeVisible()
    })

    test('should not close when clicking inside a portal element', async ({ page }) => {
        await page.click('#toggle-dropdown')
        await expect(page.locator('#dropdown')).toBeVisible()

        await page.click('#portal-btn')
        await expect(page.locator('#dropdown')).toBeVisible()
    })

    test('should not close when clicking inside a portal child', async ({ page }) => {
        await page.click('#toggle-dropdown')
        await expect(page.locator('#dropdown')).toBeVisible()

        await page.click('#portal-child')
        await expect(page.locator('#dropdown')).toBeVisible()
    })

    test('should support multiple elements array', async ({ page }) => {
        await page.click('#multi-toggle')
        await expect(page.locator('#multi-status')).toHaveText('open')

        await page.click('#multi-target-1')
        await expect(page.locator('#multi-status')).toHaveText('open')

        await page.click('#multi-target-2')
        await expect(page.locator('#multi-status')).toHaveText('open')

        await page.click('h1')
        await expect(page.locator('#multi-status')).toHaveText('closed')
    })

    test('should not fire on same-tick clicks (setTimeout protection)', async ({ page }) => {
        // Use evaluate to open and dispatch in the same JS tick
        await page.evaluate(() => {
            ;(window as any).openSameTickDropdown()
        })

        await expect(page.locator('#same-tick-status')).toHaveText('open')
        await expect(page.locator('#same-tick-dropdown')).toBeVisible()
    })

    test('cleanup before deferred listener registration prevents later outside clicks', async ({ page }) => {
        await page.click('#cleanup-before-timeout-btn')
        await page.waitForTimeout(20)

        await page.click('h1')

        await expect(page.locator('#cleanup-before-timeout-status')).toHaveText('open')
        await expect(page.locator('#cleanup-before-timeout-dropdown')).toBeVisible()
    })
})
