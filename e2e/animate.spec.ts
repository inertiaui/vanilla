import { test, expect } from './test'

test.describe('animate', () => {
    test('resolves on completion', async ({ page }) => {
        await page.click('#animate-fade-btn')
        await expect(page.locator('#status')).toHaveText('done')
    })

    test('applies keyframes visually', async ({ page }) => {
        await page.click('#animate-fade-btn')
        await expect(page.locator('#status')).toHaveText('done')
        await expect(page.locator('#box-opacity')).toHaveText('1')
    })

    test('supports custom duration and easing', async ({ page }) => {
        await page.click('#animate-custom-btn')
        await expect(page.locator('#status')).toHaveText('done')
        await expect(page.locator('#box-opacity')).toHaveText('1')
    })

    test('supports custom easing string', async ({ page }) => {
        await page.click('#animate-easing-btn')
        await expect(page.locator('#status')).toHaveText('done')
    })

    test('cancelAnimations stops running animations', async ({ page }) => {
        // Start a long animation via evaluate so we can cancel before it finishes
        await page.evaluate(() => {
            const box = document.getElementById('box')!
            box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 5000 })
        })

        // Verify animation is running
        const countBefore = await page.evaluate(() => document.getElementById('box')!.getAnimations().length)
        expect(countBefore).toBeGreaterThan(0)

        await page.click('#cancel-btn')
        await expect(page.locator('#animation-count')).toHaveText('0')
    })

    test('cancelled animation resolves gracefully', async ({ page }) => {
        await page.click('#animate-then-cancel-btn')
        await expect(page.locator('#status')).toHaveText('resolved')
    })

    test('animates reordered elements from a captured snapshot', async ({ page }) => {
        await page.click('#snapshot-reorder-btn')

        await expect(page.locator('#snapshot-order')).toHaveText('Banana, Cherry, Apple')
        await expect(page.locator('#snapshot-animation-count')).toHaveText('3')

        const report = await page.evaluate(() => (window as any).snapshotAnimationReport)

        expect(report.count).toBe(3)
        expect(report.order).toBe('Banana, Cherry, Apple')
        expect(report.transforms).toHaveLength(3)
        expect(
            report.transforms.some((transform: string) =>
                /translate3d\(0px, -?\d+(?:\.\d+)?px, 0(?:px)?\)/.test(transform),
            ),
        ).toBe(true)
    })
})
