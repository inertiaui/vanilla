import { test, expect } from './test'

test.describe('computePosition', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
    })

    test('bottom-start placement positions below reference', async ({ page }) => {
        await page.click('#pos-bottom-start')

        await expect(page.locator('#floating')).toBeVisible()

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

test.describe('autoSize option', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
    })

    test('caps height to the space below the reference and adds a scrollbar', async ({ page }) => {
        await page.click('#pos-size-bottom')

        const floating = page.locator('#floating-tall')

        // Inline styles are applied
        const maxHeight = await floating.evaluate((el) => el.style.maxHeight)
        const overflowY = await floating.evaluate((el) => el.style.overflowY)
        expect(maxHeight).toContain('min(')
        expect(maxHeight).toContain('var(--iui-max-height, 100vh)')
        expect(overflowY).toBe('auto')

        // Reference top:300 height:40 → space below ≈ 768 - 340 - 8 = 420
        const { clientHeight, scrollHeight } = await floating.evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }))
        expect(clientHeight).toBeGreaterThan(400)
        expect(clientHeight).toBeLessThan(440)

        // Content (1500px) is taller than the cap → element scrolls
        expect(scrollHeight).toBeGreaterThan(clientHeight)

        // Element stays inside the viewport
        const box = await floating.boundingBox()
        expect(box!.y + box!.height).toBeLessThanOrEqual(768)
    })

    test('shrinks to the small space left below a near-bottom reference', async ({ page }) => {
        await page.click('#pos-size-top')

        const floating = page.locator('#floating-tall')

        const maxHeight = await floating.evaluate((el) => el.style.maxHeight)
        expect(maxHeight).toContain('min(')
        expect(await floating.evaluate((el) => el.style.overflowY)).toBe('auto')

        // Reference sits ~20px from the bottom, so the cap is a small sliver and
        // the tall content scrolls rather than overflowing the viewport.
        const { clientHeight, scrollHeight } = await floating.evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }))
        expect(clientHeight).toBeGreaterThan(0)
        expect(scrollHeight).toBeGreaterThan(clientHeight)

        const box = await floating.boundingBox()
        expect(box!.y + box!.height).toBeLessThanOrEqual(768 + 2)
    })

    test('respects the --iui-max-height CSS variable cap', async ({ page }) => {
        await page.click('#pos-size-cap')

        const floating = page.locator('#floating-tall')
        // var cap (120px) is smaller than the available space → it wins
        const clientHeight = await floating.evaluate((el) => el.clientHeight)
        expect(clientHeight).toBeGreaterThan(110)
        expect(clientHeight).toBeLessThan(130)
    })

    test('leaves height unconstrained when autoSize is not set', async ({ page }) => {
        await page.click('#pos-no-size')

        const floating = page.locator('#floating-tall')
        expect(await floating.evaluate((el) => el.style.maxHeight)).toBe('')
        expect(await floating.evaluate((el) => el.style.overflowY)).toBe('')

        // No clamp → full content height, not scrollable
        const { clientHeight, scrollHeight } = await floating.evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }))
        expect(scrollHeight).toBe(clientHeight)
        expect(clientHeight).toBeGreaterThan(1000)
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

test.describe('positionTopLayerPopover', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 })
    })

    test('positions a top-layer popover and matches reference width', async ({ page }) => {
        await page.click('#pos-top-layer')

        const refBox = await page.locator('#reference-wide').boundingBox()
        const floatingBox = await page.locator('#top-layer-popover').boundingBox()

        expect(floatingBox!.y).toBeGreaterThanOrEqual(refBox!.y + refBox!.height - 2)
        expect(Math.abs(floatingBox!.x - refBox!.x)).toBeLessThan(5)
        expect(Math.abs(floatingBox!.width - refBox!.width)).toBeLessThan(2)
        await expect(page.locator('#result-placement')).toHaveText('bottom-start')

        await expect(page.locator('#top-layer-popover')).toBeVisible()
        await expect(page.locator('#floating-style-pos')).toHaveText('fixed')
    })

    test('flips a tall top-layer popover and constrains height to available space', async ({ page }) => {
        await page.click('#pos-top-layer-flip')

        const refBox = await page.locator('#reference-bottom').boundingBox()
        const floatingBox = await page.locator('#top-layer-popover').boundingBox()

        expect(floatingBox!.y + floatingBox!.height).toBeLessThanOrEqual(refBox!.y + 2)
        await expect(page.locator('#result-placement')).toHaveText('top-start')

        const { clientHeight, scrollHeight, maxHeight } = await page.locator('#top-layer-popover').evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            maxHeight: (el as HTMLElement).style.maxHeight,
        }))
        expect(maxHeight).toContain('px')
        expect(scrollHeight).toBeGreaterThan(clientHeight)
        expect(floatingBox!.y).toBeGreaterThanOrEqual(8)
    })

    test('auto-updates top-layer popovers and stops after cleanup', async ({ page }) => {
        await page.click('#start-top-layer-auto-btn')

        await page.waitForTimeout(100)
        const countAfterStart = Number(await page.locator('#top-layer-auto-update-count').textContent())

        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterScroll = Number(await page.locator('#top-layer-auto-update-count').textContent())
        expect(countAfterScroll).toBeGreaterThan(countAfterStart)

        await page.click('#stop-top-layer-auto-btn')
        const countAfterStop = Number(await page.locator('#top-layer-auto-update-count').textContent())
        await page.evaluate(() => window.scrollBy(0, 100))
        await page.waitForTimeout(100)
        const countAfterSecondScroll = Number(await page.locator('#top-layer-auto-update-count').textContent())
        expect(countAfterSecondScroll).toBe(countAfterStop)
    })
})
