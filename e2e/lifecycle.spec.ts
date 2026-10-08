import type { DialogController, TooltipController } from '../src/index'
import { test, expect } from './test'

declare global {
    interface Window {
        lifecycle: {
            tip: TooltipController
            outer: { controller: DialogController; counts: () => { mounts: number; cleanups: number } }
            inner: { controller: DialogController }
            errors: string[]
            releaseTheme: () => void
        }
    }
}

for (const fallback of [false, true]) {
    test.describe(fallback ? 'fallback lifecycle' : 'native lifecycle', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(`/e2e/pages/lifecycle.html${fallback ? '?fallback' : ''}`)
        })
        test.afterEach(async ({ page }) => {
            expect(await page.evaluate(() => window.lifecycle.errors)).toEqual([])
        })
        test('keeps focus and pointer intent independent, preserves width, and dismisses with Escape', async ({
            page,
        }) => {
            await page.locator('#trigger').focus()
            await page.locator('#trigger').hover()
            await expect(page.getByRole('tooltip')).toBeVisible()
            expect((await page.getByRole('tooltip').boundingBox())!.width).toBeLessThanOrEqual(198)
            await page.locator('#outside').hover()
            await expect(page.getByRole('tooltip')).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(page.getByRole('tooltip')).toHaveCount(0)
            await expect(page.locator('#trigger')).toBeFocused()
        })
        test('cancels stale hiding when the tooltip is requested again', async ({ page }) => {
            await page.locator('#trigger').focus()
            await expect(page.getByRole('tooltip')).toBeVisible()
            await page.evaluate(async () => {
                const hiding = window.lifecycle.tip.hide()
                window.lifecycle.tip.onMouseEnter()
                await hiding
            })
            await expect(page.getByRole('tooltip')).toBeVisible()
        })
        test('cancels a pending tooltip and detaches open tooltip behavior on cleanup', async ({ page }) => {
            await page.evaluate(() => {
                window.lifecycle.tip.onMouseEnter()
                window.lifecycle.tip.cleanup()
            })
            await page.waitForTimeout(50)
            await expect(page.getByRole('tooltip')).toHaveCount(0)
            await page.locator('#trigger').focus()
            await expect(page.getByRole('tooltip')).toBeVisible()
            await page.evaluate(() => {
                window.lifecycle.tip.cleanup()
                window.lifecycle.tip.mount()
            })
            await page.keyboard.press('Escape')
            await expect(page.getByRole('tooltip')).toHaveCount(0)
        })
        test('handles a tooltip inside a dialog without dismissing the dialog', async ({ page }) => {
            await page.click('#open-dialog')
            await expect(page.locator('#outer .cancel')).toBeFocused()
            await page.locator('#trigger').focus()
            await expect(page.getByRole('tooltip')).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(page.getByRole('tooltip')).toHaveCount(0)
            await expect(page.locator('#outer')).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(page.locator('#outer')).toHaveCount(0)
            await expect(page.locator('#open-dialog')).toBeFocused()
            await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
        })
        test('does not intercept Escape from another focused dialog control', async ({ page }) => {
            await page.locator('#open-dialog').click()
            await expect(page.locator('#outer .cancel')).toBeFocused()
            await page.locator('#trigger').hover()
            await expect(page.getByRole('tooltip')).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(page.locator('#outer')).toHaveCount(0)
        })

        test('keeps a dialog open after reopening during a close transition', async ({ page }) => {
            await page.click('#open-dialog')
            await expect(page.locator('#outer')).toBeVisible()
            await page.evaluate(async () => {
                const closing = window.lifecycle.outer.controller.close()
                window.lifecycle.outer.controller.open()
                await closing
            })
            await expect(page.locator('#outer')).toBeVisible()
            expect(await page.evaluate(() => window.lifecycle.outer.controller.isOpen)).toBe(true)
            await page.click('#outer .cancel')
            await expect(page.locator('#outer')).toHaveCount(0)
            await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
        })
        test('keeps dialog content accessible and balances cleanup across remounts', async ({ page }) => {
            await page.click('#open-dialog')
            await expect(page.locator('#outer')).toBeVisible()
            expect(
                await page.locator('#outer').evaluate((el) => el.closest('[inert], [aria-hidden=true]') === null),
            ).toBe(true)
            await page.evaluate(() => {
                window.lifecycle.outer.controller.cleanup()
                window.lifecycle.outer.controller.mount()
            })
            await page.click('#outer .cancel')
            await expect(page.locator('#outer')).toHaveCount(0)
            expect(await page.evaluate(() => window.lifecycle.outer.counts())).toEqual({ mounts: 2, cleanups: 2 })
            await expect(page.locator('#open-dialog')).toBeFocused()
            await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
        })
        test('closes only the top dialog and retains the outer scroll lock', async ({ page }) => {
            await page.click('#open-dialog')
            await expect(page.locator('#outer')).toBeVisible()
            await page.evaluate(() => window.lifecycle.inner.controller.open())
            await expect(page.locator('#inner')).toBeVisible()
            await page.locator('#inner .cancel').focus()
            await page.keyboard.press('Escape')
            await expect(page.locator('#inner')).toHaveCount(0)
            await expect(page.locator('#outer')).toBeVisible()
            await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
            await page.click('#outer .cancel')
            await expect(page.locator('#outer')).toHaveCount(0)
            await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
        })
    })
}

test('copies selected inherited variables, updates them and restores the original inline value', async ({ page }) => {
    const target = page.locator('#copied')
    await expect(target).toHaveCSS('--demo-color', 'rgb(210, 220, 230)')
    await page.locator('#scope').evaluate((el) => el.style.setProperty('--demo-color', 'red'))
    await expect(target).toHaveCSS('--demo-color', 'red')
    await page.evaluate(() => window.lifecycle.releaseTheme())
    expect(
        await target.evaluate((el) => [
            el.style.getPropertyValue('--demo-color'),
            el.style.getPropertyPriority('--demo-color'),
        ]),
    ).toEqual(['old', 'important'])
    await page.locator('#scope').evaluate((el) => el.style.setProperty('--demo-color', 'green'))
    await expect(target).toHaveCSS('--demo-color', 'old')
})

test('preserves a consumer inline override when inheritance is cleaned up', async ({ page }) => {
    await expect(page.locator('#copied')).toHaveCSS('--demo-color', 'rgb(210, 220, 230)')
    await page.locator('#copied').evaluate((el) => el.style.setProperty('--demo-color', 'purple'))
    await page.evaluate(() => window.lifecycle.releaseTheme())
    await expect(page.locator('#copied')).toHaveCSS('--demo-color', 'purple')
})
