import { test, expect } from './test'

type ReorderHitBox = { index: number; left: number; top: number; right: number; bottom: number }
type ReorderPoint = { clientX: number; clientY: number }

declare global {
    interface Window {
        reorder: {
            moveArrayItem: <T>(items: readonly T[], fromIndex: number, toIndex: number) => T[]
            getInsertionIndexFromPoint: (hitBoxes: readonly ReorderHitBox[], point: ReorderPoint) => number | null
            resolveTargetIndexFromInsertion: (
                fromIndex: number,
                insertionIndex: number | null,
                itemCount: number,
            ) => number | null
        }
    }
}

test.beforeEach(async ({ page }) => {
    await expect(page.locator('#order-value')).toHaveText('Apple,Banana,Cherry,Date')
})

test.describe('moveArrayItem', () => {
    test('moves item forward', async ({ page }) => {
        const result = await page.evaluate(() => window.reorder.moveArrayItem(['a', 'b', 'c', 'd'], 0, 2))
        expect(result).toEqual(['b', 'c', 'a', 'd'])
    })

    test('moves item backward', async ({ page }) => {
        const result = await page.evaluate(() => window.reorder.moveArrayItem(['a', 'b', 'c', 'd'], 3, 1))
        expect(result).toEqual(['a', 'd', 'b', 'c'])
    })

    test('returns copy for no-op and out-of-range moves', async ({ page }) => {
        const result = await page.evaluate(() => {
            const src = ['a', 'b', 'c']
            return {
                noop: window.reorder.moveArrayItem(src, 1, 1),
                oob: window.reorder.moveArrayItem(src, 0, 5),
                sameRef: window.reorder.moveArrayItem(src, 1, 1) === src,
            }
        })
        expect(result.noop).toEqual(['a', 'b', 'c'])
        expect(result.oob).toEqual(['a', 'b', 'c'])
        expect(result.sameRef).toBe(false)
    })
})

test.describe('resolveTargetIndexFromInsertion', () => {
    test('shifts insertion index past the dragged item left by one', async ({ page }) => {
        const result = await page.evaluate(() => ({
            afterFrom: window.reorder.resolveTargetIndexFromInsertion(0, 3, 4),
            beforeFrom: window.reorder.resolveTargetIndexFromInsertion(3, 1, 4),
            atFrom: window.reorder.resolveTargetIndexFromInsertion(1, 1, 4),
        }))
        expect(result.afterFrom).toBe(2)
        expect(result.beforeFrom).toBe(1)
        expect(result.atFrom).toBe(1)
    })

    test('returns null for null insertion, single item, or out-of-range from', async ({ page }) => {
        const result = await page.evaluate(() => ({
            nullInsertion: window.reorder.resolveTargetIndexFromInsertion(0, null, 4),
            single: window.reorder.resolveTargetIndexFromInsertion(0, 1, 1),
            oobFrom: window.reorder.resolveTargetIndexFromInsertion(5, 1, 4),
        }))
        expect(result.nullInsertion).toBeNull()
        expect(result.single).toBeNull()
        expect(result.oobFrom).toBeNull()
    })
})

test.describe('getInsertionIndexFromPoint', () => {
    test('resolves vertical column insertion by row midpoint', async ({ page }) => {
        const result = await page.evaluate(() => {
            const hitBoxes = [
                { index: 0, left: 0, top: 0, right: 100, bottom: 20 },
                { index: 1, left: 0, top: 20, right: 100, bottom: 40 },
                { index: 2, left: 0, top: 40, right: 100, bottom: 60 },
            ]
            return {
                topHalf: window.reorder.getInsertionIndexFromPoint(hitBoxes, { clientX: 50, clientY: 5 }),
                bottomHalf: window.reorder.getInsertionIndexFromPoint(hitBoxes, { clientX: 50, clientY: 25 }),
                past: window.reorder.getInsertionIndexFromPoint(hitBoxes, { clientX: 50, clientY: 59 }),
                outside: window.reorder.getInsertionIndexFromPoint(hitBoxes, { clientX: 200, clientY: 5 }),
            }
        })
        expect(result.topHalf).toBe(0)
        expect(result.bottomHalf).toBe(1)
        expect(result.past).toBe(3)
        expect(result.outside).toBeNull()
    })

    test('returns null with no hit boxes', async ({ page }) => {
        const result = await page.evaluate(() =>
            window.reorder.getInsertionIndexFromPoint([], { clientX: 0, clientY: 0 }),
        )
        expect(result).toBeNull()
    })
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
})
