import { test, expect } from './test'

declare global {
    interface Window {
        nativePopoverDemo: {
            focusInside: () => void
            focusOutside: () => void
            metrics: () => { referenceBottom: number; popoverTop: number; gap: number; widthDelta: number }
        }
    }
}

test.describe('createNativePopoverDisclosure', () => {
    test('opens, positions, auto-updates, closes, and hides the native popover', async ({ page }) => {
        await page.click('#reference')

        await expect(page.locator('#open-value')).toHaveText('true')
        await expect(page.locator('#native-open-value')).toHaveText('true')
        await expect(page.locator('#before-count')).toHaveText('1')
        await expect(page.locator('#change-count')).toHaveText('1')

        const initial = await page.evaluate(() => window.nativePopoverDemo.metrics())
        expect(initial.gap).toBeGreaterThanOrEqual(4)
        expect(initial.gap).toBeLessThanOrEqual(8)
        expect(initial.widthDelta).toBeLessThan(2)

        await page.evaluate(() => window.scrollBy(0, 80))
        await page.waitForTimeout(100)

        const afterScroll = await page.evaluate(() => window.nativePopoverDemo.metrics())
        expect(afterScroll.gap).toBeGreaterThanOrEqual(4)
        expect(afterScroll.gap).toBeLessThanOrEqual(8)

        await page.click('#close-btn')

        await expect(page.locator('#open-value')).toHaveText('false')
        await expect(page.locator('#native-open-value')).toHaveText('false')
        await expect(page.locator('#close-count')).toHaveText('1')
        await expect(page.locator('#last-close-value')).toHaveText('true')
    })

    test('can close state without hiding the native popover', async ({ page }) => {
        await page.click('#reference')
        await page.click('#close-no-hide-btn')

        await expect(page.locator('#open-value')).toHaveText('false')
        await expect(page.locator('#native-open-value')).toHaveText('true')
        await expect(page.locator('#last-close-value')).toHaveText('true')
    })

    test('toggle delegates to open and close callbacks', async ({ page }) => {
        await page.click('#toggle-btn')

        await expect(page.locator('#open-value')).toHaveText('true')
        await expect(page.locator('#native-open-value')).toHaveText('true')
        await expect(page.locator('#before-count')).toHaveText('1')

        await page.click('#toggle-btn')

        await expect(page.locator('#open-value')).toHaveText('false')
        await expect(page.locator('#native-open-value')).toHaveText('false')
        await expect(page.locator('#close-count')).toHaveText('1')
    })

    test('syncs closed state from native toggle events', async ({ page }) => {
        await page.click('#reference')
        await page.click('#native-hide-btn')

        await expect(page.locator('#open-value')).toHaveText('false')
        await expect(page.locator('#native-open-value')).toHaveText('false')
        await expect(page.locator('#toggle-close-count')).toHaveText('1')
    })

    test('dismisses on focus out and cleanup stops auto updates', async ({ page }) => {
        await page.click('#reference')

        await page.evaluate(() => window.nativePopoverDemo.focusInside())
        await page.evaluate(() => window.nativePopoverDemo.focusOutside())

        await expect(page.locator('#dismiss-count')).toHaveText('1')
        await expect(page.locator('#open-value')).toHaveText('false')
        await expect(page.locator('#native-open-value')).toHaveText('false')

        await page.click('#reference')
        await page.click('#cleanup-btn')

        const beforeScroll = await page.evaluate(() => window.nativePopoverDemo.metrics())
        await page.evaluate(() => window.scrollBy(0, 120))
        await page.waitForTimeout(100)
        const afterScroll = await page.evaluate(() => window.nativePopoverDemo.metrics())

        expect(Math.abs(afterScroll.gap - beforeScroll.gap)).toBeGreaterThan(60)
    })
})
