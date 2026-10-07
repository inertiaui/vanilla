import type { PopoverController } from '../src/popover'
import { test, expect } from './test'

declare global {
    interface Window {
        popoverDemo: {
            controller: PopoverController
            metrics: () => { mounts: number; cleanups: number; events: string[]; errors: string[]; open: boolean }
        }
    }
}

for (const fallback of [false, true]) {
    test.describe(fallback ? 'fallback controller' : 'native controller', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(`/e2e/pages/popover.html${fallback ? '?fallback' : ''}`)
            await page.click('#open-dialog')
        })

        test.afterEach(async ({ page }) => {
            expect((await page.evaluate(() => window.popoverDemo.metrics())).errors).toEqual([])
        })

        test('opens from either arrow key, restores focus and closes on a second trigger click', async ({ page }) => {
            await page.locator('#reference').press('ArrowDown')
            await expect(page.locator('#first')).toBeFocused()
            await expect(page.locator('#first')).toHaveAttribute('tabindex', '0')
            await page.keyboard.press('Escape')
            await expect(page.locator('#panel')).toHaveCount(0)
            await expect(page.locator('#reference')).toBeFocused()
            await expect(page.locator('dialog')).toBeVisible()

            await page.locator('#reference').press('ArrowUp')
            await expect(page.locator('#last')).toBeFocused()
            await expect(page.locator('#last')).toHaveAttribute('tabindex', '0')
            await expect(page.locator('#first')).toHaveAttribute('tabindex', '-1')
            await page.keyboard.press('Escape')
            await page.click('#reference')
            await expect(page.locator('#panel')).toBeVisible()
            await page.click('#reference')
            await expect(page.locator('#panel')).toHaveCount(0)
            await expect(page.locator('#state')).toHaveText('false')
        })

        for (const [direction, width] of [
            ['ltr', 1280],
            ['rtl', 1280],
            ['rtl', 390],
        ] as const) {
            test(`inherits its theme and follows scrolling in ${direction} at ${width}px`, async ({ page }) => {
                await page.setViewportSize({ width, height: 800 })
                await page.locator('dialog').evaluate((element, dir) => {
                    element.dir = dir
                }, direction)
                await page.click('#reference')
                await expect(page.locator('#panel')).toHaveCSS('background-color', 'rgb(210, 220, 230)')
                await page.locator('#scroller').evaluate((element) => {
                    element.scrollTop = 12
                })
                await expect
                    .poll(() =>
                        page.evaluate(() => {
                            const panel = document.querySelector('#panel')!.getBoundingClientRect()
                            const reference = document.querySelector('#reference')!.getBoundingClientRect()
                            return Math.abs(panel.top - reference.bottom - 8)
                        }),
                    )
                    .toBeLessThan(2)
                expect(
                    await page.locator('#panel').evaluate((element) => {
                        const rect = element.getBoundingClientRect()
                        return (
                            rect.left >= 0 &&
                            rect.right <= innerWidth &&
                            element.contains(document.elementFromPoint(rect.left + 10, rect.top + 10))
                        )
                    }),
                ).toBe(true)
                if (width === 1280) {
                    expect(
                        await page.evaluate((dir) => {
                            const panel = document.querySelector('#panel')!.getBoundingClientRect()
                            const reference = document.querySelector('#reference')!.getBoundingClientRect()
                            return Math.abs(dir === 'rtl' ? panel.right - reference.right : panel.left - reference.left)
                        }, direction),
                    ).toBeLessThan(2)
                }
                await page.click('#last')
                await expect(page.locator('#panel')).toHaveCount(0)
                expect((await page.evaluate(() => window.popoverDemo.metrics())).events).toEqual(['item', 'closed'])
            })
        }

        test('dismisses on focus leaving without stealing the new focus', async ({ page }) => {
            // Consumers may place the trigger beside unrelated controls in a shared container.
            await page.locator('#outside').evaluate((outside) => outside.before(document.querySelector('#reference')!))
            await page.click('#reference')
            await expect(page.locator('#first')).toBeFocused()
            await page.locator('#outside').focus()
            await expect(page.locator('#panel')).toHaveCount(0)
            await expect(page.locator('#outside')).toBeFocused()
            expect((await page.evaluate(() => window.popoverDemo.metrics())).cleanups).toBe(1)
        })

        test('cleans up and remounts an open panel without duplicate listeners or losing state', async ({ page }) => {
            await page.click('#reference')
            await expect(page.locator('#first')).toBeFocused()
            await page.evaluate(() => {
                window.popoverDemo.controller.cleanup()
                window.popoverDemo.controller.mount()
            })
            await expect(page.locator('#first')).toBeFocused()
            expect((await page.evaluate(() => window.popoverDemo.metrics())).open).toBe(true)
            await page.click('#last')
            await expect(page.locator('#panel')).toHaveCount(0)
            expect(await page.evaluate(() => window.popoverDemo.metrics())).toMatchObject({
                mounts: 2,
                cleanups: 2,
                events: ['item', 'closed'],
            })
        })

        test('cancels deferred menu dismissal when its owner disposes the panel', async ({ page }) => {
            await page.click('#reference')
            await expect(page.locator('#first')).toBeFocused()
            await page.evaluate(() => {
                ;(document.querySelector('#last') as HTMLElement).click()
                window.popoverDemo.controller.cleanup()
                document.querySelector('#panel')!.remove()
            })
            await page.waitForTimeout(30)
            expect(await page.evaluate(() => window.popoverDemo.metrics())).toMatchObject({
                cleanups: 1,
                events: ['item'],
            })
        })

        test('supports non-menu panels and consumer focus hooks', async ({ page }) => {
            await page.goto(`/e2e/pages/popover.html?input${fallback ? '&fallback' : ''}`)
            await page.click('#open-dialog')
            await page.click('#reference')
            await expect(page.getByRole('textbox')).toBeFocused()
            await page.getByRole('textbox').press('Escape')
            await expect(page.locator('#panel')).toHaveCount(0)
            await expect(page.locator('#reference')).toBeFocused()
            await expect(page.locator('dialog')).toBeVisible()
        })
    })
}

test('syncs native light dismissal with one close callback', async ({ page }) => {
    await page.click('#open-dialog')
    await page.click('#reference')
    await expect(page.locator('#first')).toBeFocused()
    await page.click('#outside')
    await expect(page.locator('#panel')).toHaveCount(0)
    await expect(page.locator('#outside')).toBeFocused()
    expect(await page.evaluate(() => window.popoverDemo.metrics())).toMatchObject({
        open: false,
        cleanups: 1,
        events: ['closed'],
    })
})
