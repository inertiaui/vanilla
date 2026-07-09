import { test, expect } from './test'

declare global {
    interface Window {
        reorderLastPointerId: number | null
        reorderStablePointerId: number | null
    }
}

test.beforeEach(async ({ page }) => {
    await expect(page.locator('#order-value')).toHaveText('Apple,Banana,Cherry,Date')
})

test.describe('keyboard reorder', () => {
    test('ArrowDown moves item down', async ({ page }) => {
        await expect(page.locator('#order-value')).toHaveText('Apple,Banana,Cherry,Date')
        await page.locator('#item-0').focus()
        await page.keyboard.press('ArrowDown')
        await expect(page.locator('#order-value')).toHaveText('Banana,Apple,Cherry,Date')
        await expect(page.locator('#move-value')).toHaveText('keyboard: 0 -> 1')
    })

    test('ArrowUp moves item up', async ({ page }) => {
        await page.locator('#item-2').focus()
        await page.keyboard.press('ArrowUp')
        await expect(page.locator('#order-value')).toHaveText('Apple,Cherry,Banana,Date')
    })

    test('ArrowUp on first item is a no-op', async ({ page }) => {
        await page.locator('#item-0').focus()
        await page.keyboard.press('ArrowUp')
        await expect(page.locator('#order-value')).toHaveText('Apple,Banana,Cherry,Date')
    })
})

test.describe('pointer reorder', () => {
    test('dragging a handle reorders the list', async ({ page }) => {
        await expect(page.locator('#order-value')).toHaveText('Apple,Banana,Cherry,Date')

        const handle = page.locator('#handle-0')
        const target = page.locator('#item-2')
        const handleBox = await handle.boundingBox()
        const targetBox = await target.boundingBox()

        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
        await page.mouse.down()
        // Drag past the midpoint of the third item so it lands after it.
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height - 2)
        await expect(page.locator('#dragging-value')).toHaveText('yes')
        await page.mouse.up()

        await expect(page.locator('#dragging-value')).toHaveText('no')
        await expect(page.locator('#move-value')).toHaveText(/^pointer: 0 -> \d$/)
        await expect(page.locator('#order-value')).not.toHaveText('Apple,Banana,Cherry,Date')
    })

    test('starting a drag marks the item as dragged', async ({ page }) => {
        const handle = page.locator('#handle-1')
        const handleBox = await handle.boundingBox()

        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 5)
        await expect(page.locator('#item-1')).toHaveClass(/dragged/)
        await page.mouse.up()
    })

    test('captures the active pointer when the browser supports pointer capture', async ({ page }) => {
        const handle = page.locator('#stable-handle')
        const handleBox = await handle.boundingBox()

        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
        await page.mouse.down()

        const hasCapture = await handle.evaluate((el) => {
            const pointerId = window.reorderStablePointerId

            return pointerId !== null && typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(pointerId)
        })

        expect(hasCapture).toBe(true)
        await expect(page.locator('#stable-dragging-value')).toHaveText('yes')

        await page.mouse.up()
        await expect(page.locator('#stable-dragging-value')).toHaveText('no')
    })

    test('starts from nested handle content when the listener is on an ancestor', async ({ page }) => {
        const icon = page.locator('#nested-icon')
        const iconBox = await icon.boundingBox()

        await page.mouse.move(iconBox!.x + iconBox!.width / 2, iconBox!.y + iconBox!.height / 2)
        await page.mouse.down()

        await expect(page.locator('#nested-dragging-value')).toHaveText('yes')

        await page.mouse.up()
        await expect(page.locator('#nested-dragging-value')).toHaveText('no')
    })

    test('commits the last valid preview when pointerup coordinates are outside the list', async ({ page }) => {
        const handle = page.locator('#handle-3')
        const firstItem = page.locator('#item-0')
        const handleBox = await handle.boundingBox()
        const firstBox = await firstItem.boundingBox()

        await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
        await page.mouse.down()
        await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + 2)
        await expect(page.locator('#target-value')).toHaveText('0')

        await page.evaluate(() => {
            window.dispatchEvent(
                new PointerEvent('pointerup', {
                    bubbles: true,
                    pointerId: window.reorderLastPointerId ?? 1,
                    clientX: -200,
                    clientY: -200,
                }),
            )
        })
        await page.mouse.up()

        await expect(page.locator('#dragging-value')).toHaveText('no')
        await expect(page.locator('#move-value')).toHaveText('pointer: 3 -> 0')
        await expect(page.locator('#order-value')).toHaveText('Date,Apple,Banana,Cherry')
    })

    test('does not commit when the pointer leaves the reorder bounds before release', async ({ page }) => {
        const handle = page.locator('#handle-3')
        const firstItem = page.locator('#item-0')
        const handleBox = await handle.boundingBox()
        const firstBox = await firstItem.boundingBox()

        await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
        await page.mouse.down()
        await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + 2)
        await expect(page.locator('#target-value')).toHaveText('0')

        await page.mouse.move(firstBox!.x - 80, firstBox!.y + 2)
        await expect(page.locator('#target-value')).toHaveText('0')
        await page.mouse.up()

        await expect(page.locator('#dragging-value')).toHaveText('no')
        await expect(page.locator('#move-value')).toHaveText('none')
        await expect(page.locator('#order-value')).toHaveText('Apple,Banana,Cherry,Date')
    })

    test('auto-scrolls configured containers while dragging', async ({ page }) => {
        const handle = page.locator('#auto-handle-0')
        const box = page.locator('#auto-scroll-box')
        await handle.scrollIntoViewIfNeeded()

        const handleBox = await handle.boundingBox()
        const boxBox = await box.boundingBox()

        await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
        await page.mouse.down()
        await page.mouse.move(boxBox!.x + boxBox!.width / 2, boxBox!.y + boxBox!.height - 3)

        await expect(page.locator('#auto-scroll-dragging')).toHaveText('yes')
        await expect.poll(async () => Number(await page.locator('#auto-scroll-top').textContent())).toBeGreaterThan(0)
        await expect
            .poll(async () => Number(await page.locator('#auto-scroll-frames').textContent()))
            .toBeGreaterThan(0)

        await page.mouse.up()
        await expect(page.locator('#auto-scroll-dragging')).toHaveText('no')
    })
})
