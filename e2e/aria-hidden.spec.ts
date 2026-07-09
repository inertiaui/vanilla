import { test, expect } from './test'

declare global {
    interface Window {
        ariaHiddenDemo: {
            markInertWithExistingAria: () => {
                marked: { inert: boolean; ariaHidden: string | null }
                restored: { inert: boolean; ariaHidden: string | null }
            }
            markInertWithoutNativeSupport: () =>
                | { supported: false }
                | {
                      supported: true
                      marked: { hasNativeInert: boolean; ariaHidden: string | null }
                      restored: { hasNativeInert: boolean; ariaHidden: string | null }
                  }
        }
    }
}

test.describe('markAriaHidden', () => {
    test('marks element as aria-hidden', async ({ page }) => {
        await page.click('#mark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')
    })

    test('accepts CSS selector', async ({ page }) => {
        await page.click('#mark-by-selector-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')
    })

    test('cleanup removes aria-hidden', async ({ page }) => {
        await page.click('#mark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')

        await page.click('#unmark-btn')
        await expect(page.locator('#aria-value')).toHaveText('null')
    })

    test('restores original aria-hidden value', async ({ page }) => {
        await expect(page.locator('#aria-value-existing')).toHaveText('false')

        await page.click('#mark-existing-btn')
        await expect(page.locator('#aria-value-existing')).toHaveText('true')

        await page.click('#unmark-existing-btn')
        await expect(page.locator('#aria-value-existing')).toHaveText('false')
    })

    test('reference counting with nested marks', async ({ page }) => {
        await page.click('#mark-btn')
        await page.click('#mark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')

        await page.click('#unmark-btn')
        await expect(page.locator('#aria-value')).toHaveText('true')

        await page.click('#unmark-btn')
        await expect(page.locator('#aria-value')).toHaveText('null')
    })

    test('noop for non-existent selector', async ({ page }) => {
        await page.click('#mark-nonexistent-btn')
        await page.click('#unmark-nonexistent-btn')
        // No error, page still functional
        await expect(page.locator('#aria-value')).toHaveText('null')
    })

    test('idempotent cleanup', async ({ page }) => {
        await page.click('#mark-btn')
        await page.click('#mark-btn')
        await page.click('#unmark-btn')
        await page.click('#unmark-btn')
        await page.click('#unmark-btn') // extra call, should be safe
        await expect(page.locator('#aria-value')).toHaveText('null')
    })

    test('marks element inert and restores it on cleanup', async ({ page }) => {
        await page.click('#mark-inert-btn')
        await expect(page.locator('#inert-value')).toHaveText('true')

        await page.click('#unmark-inert-btn')
        await expect(page.locator('#inert-value')).toHaveText('false')
        await expect(page.locator('#inert-aria-value')).toHaveText('null')
    })

    test('accepts selector and reference-counts inert marks', async ({ page }) => {
        await page.click('#mark-inert-btn')
        await page.click('#mark-inert-selector-btn')
        await expect(page.locator('#inert-value')).toHaveText('true')

        await page.click('#unmark-inert-btn')
        await expect(page.locator('#inert-value')).toHaveText('true')

        await page.click('#unmark-inert-btn')
        await expect(page.locator('#inert-value')).toHaveText('false')
    })

    test('markInert restores an existing aria-hidden value', async ({ page }) => {
        const result = await page.evaluate(() => window.ariaHiddenDemo.markInertWithExistingAria())

        expect(result.marked.inert || result.marked.ariaHidden === 'true').toBe(true)
        expect(result.restored.inert).toBe(false)
        expect(result.restored.ariaHidden).toBe('false')
    })

    test('markInert falls back to aria-hidden when native inert is unavailable', async ({ page }) => {
        const result = await page.evaluate(() => window.ariaHiddenDemo.markInertWithoutNativeSupport())

        if (!result.supported) {
            test.skip(true, 'Native inert descriptor is not configurable in this browser')
            return
        }

        expect(result.marked.hasNativeInert).toBe(false)
        expect(result.marked.ariaHidden).toBe('true')
        expect(result.restored.hasNativeInert).toBe(false)
        expect(result.restored.ariaHidden).toBe('false')
    })
})
