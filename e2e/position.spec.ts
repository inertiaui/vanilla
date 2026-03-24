import { test, expect } from './test'

test.describe('computePosition', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
    })

    test('bottom-start placement positions below reference', async ({ page }) => {
        await page.click('#pos-bottom-start')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating should be below reference and left-aligned
        expect(floatingBox!.y).toBeGreaterThanOrEqual(refBox!.y + refBox!.height - 2)
        expect(Math.abs(floatingBox!.x - refBox!.x)).toBeLessThan(5)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')
    })

    test('bottom (center) placement centers horizontally', async ({ page }) => {
        await page.click('#pos-bottom')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating center should be close to reference center
        const refCenter = refBox!.x + refBox!.width / 2
        const floatingCenter = floatingBox!.x + floatingBox!.width / 2
        expect(Math.abs(floatingCenter - refCenter)).toBeLessThan(5)
    })

    test('bottom-end placement right-aligns', async ({ page }) => {
        await page.click('#pos-bottom-end')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating right edge should align with reference right edge
        const refRight = refBox!.x + refBox!.width
        const floatingRight = floatingBox!.x + floatingBox!.width
        expect(Math.abs(floatingRight - refRight)).toBeLessThan(5)
    })

    test('top placement positions above reference', async ({ page }) => {
        await page.click('#pos-top')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating bottom should be at or above reference top
        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
        await expect(page.locator('#result-placement')).toHaveText('top')
    })

    test('top-start placement positions above and left-aligned', async ({ page }) => {
        await page.click('#pos-top-start')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
        expect(Math.abs(floatingBox!.x - refBox!.x)).toBeLessThan(5)
    })

    test('right placement positions to the right', async ({ page }) => {
        await page.click('#pos-right')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // Floating left edge should be at or after reference right edge
        expect(floatingBox!.x).toBeGreaterThanOrEqual(refBox!.x + refBox!.width - 2)
    })

    test('applies offset', async ({ page }) => {
        await page.click('#pos-with-offset')

        const refBox = await page.locator('#reference').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // With offset=8, the gap between reference bottom and floating top should be ~8px
        const gap = floatingBox!.y - (refBox!.y + refBox!.height)
        expect(gap).toBeGreaterThanOrEqual(6)
        expect(gap).toBeLessThanOrEqual(10)
    })

    test('flips when overflowing viewport', async ({ page }) => {
        await page.click('#pos-flip-btn')

        const refBox = await page.locator('#reference-bottom').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // The floating element should be ABOVE the reference (flipped from bottom to top)
        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
    })

    test('does not flip when flip is disabled', async ({ page }) => {
        await page.click('#pos-no-flip')

        const refBox = await page.locator('#reference-bottom').boundingBox()
        const floatingBox = await page.locator('#floating').boundingBox()

        // The floating element should be BELOW the reference (not flipped)
        expect(floatingBox!.y).toBeGreaterThanOrEqual(refBox!.y + refBox!.height - 2)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')
    })

    test('floating element is visible and positioned', async ({ page }) => {
        await page.click('#pos-bottom-start')

        const floating = page.locator('#floating')
        await expect(floating).toBeVisible()

        // Should have fixed positioning
        const position = await floating.evaluate((el) => getComputedStyle(el).position)
        expect(position).toBe('fixed')
    })
})

test.describe('autoUpdate', () => {
    test('calls update on scroll and stops after cleanup', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
        await page.click('#start-auto-btn')

        // Wait for initial RAF-batched updates to settle
        await page.waitForTimeout(100)
        const countAfterStart = Number(await page.locator('#auto-update-count').textContent())

        // Scroll to trigger update
        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterScroll = Number(await page.locator('#auto-update-count').textContent())
        expect(countAfterScroll).toBeGreaterThan(countAfterStart)

        // Stop and scroll again
        await page.click('#stop-auto-btn')
        const countAfterStop = Number(await page.locator('#auto-update-count').textContent())
        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterSecondScroll = Number(await page.locator('#auto-update-count').textContent())
        expect(countAfterSecondScroll).toBe(countAfterStop)
    })
})
