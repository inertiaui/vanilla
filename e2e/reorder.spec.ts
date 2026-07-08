import { test, expect } from './test'

type ReorderHitBox = { index: number; left: number; top: number; right: number; bottom: number }
type ReorderPoint = { clientX: number; clientY: number }

declare global {
    interface Window {
        reorder: {
            createAutoScroller: (options?: {
                edgeThreshold?: number
                maxSpeed?: number
                axis?: 'x' | 'y' | 'both'
                getScrollContainers?: (element: Element | null) => Array<Element | Window>
                onScroll?: () => void
            }) => {
                update: (point: ReorderPoint, element?: Element | null) => void
                stop: () => void
                cleanup: () => void
                isScrolling: () => boolean
            }
            findReorderHandle: (event: Event, boundary?: EventTarget | null) => HTMLElement | null
            getClosestHitBoxByCenter: (
                hitBoxes: readonly ReorderHitBox[],
                point: ReorderPoint,
                options?: { direction?: 'up' | 'down' | 'left' | 'right'; oppositeDirectionPenalty?: number },
            ) => ReorderHitBox | null
            getDirectionBiasedHitBox: (
                hitBoxes: readonly ReorderHitBox[],
                point: ReorderPoint,
                direction: 'up' | 'down' | 'left' | 'right',
            ) => ReorderHitBox | null
            getHitBoxCenter: (hitBox: ReorderHitBox) => ReorderPoint
            getIntersectingHitBox: (hitBoxes: readonly ReorderHitBox[], point: ReorderPoint) => ReorderHitBox | null
            moveArrayItem: <T>(items: readonly T[], fromIndex: number, toIndex: number) => T[]
            getInsertionIndexFromPoint: (
                hitBoxes: readonly ReorderHitBox[],
                point: ReorderPoint,
                options?: { bounds?: { left: number; top: number; right: number; bottom: number } | null },
            ) => number | null
            pointerIntersectsHitBox: (hitBox: ReorderHitBox, point: ReorderPoint) => boolean
            resolveTargetIndexFromInsertion: (
                fromIndex: number,
                insertionIndex: number | null,
                itemCount: number,
            ) => number | null
        }
        reorderLastPointerId: number | null
        reorderStablePointerId: number | null
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

    test('uses optional outer bounds without moving item midpoints', async ({ page }) => {
        const result = await page.evaluate(() => {
            const hitBoxes = [
                { index: 0, left: 0, top: 20, right: 100, bottom: 40 },
                { index: 1, left: 0, top: 40, right: 100, bottom: 60 },
            ]

            return {
                outsideWithoutBounds: window.reorder.getInsertionIndexFromPoint(hitBoxes, {
                    clientX: 50,
                    clientY: 10,
                }),
                beforeFirstInsideBounds: window.reorder.getInsertionIndexFromPoint(
                    hitBoxes,
                    { clientX: 50, clientY: 10 },
                    { bounds: { left: 0, top: 0, right: 100, bottom: 80 } },
                ),
                afterLastInsideBounds: window.reorder.getInsertionIndexFromPoint(
                    hitBoxes,
                    { clientX: 50, clientY: 70 },
                    { bounds: { left: 0, top: 0, right: 100, bottom: 80 } },
                ),
                outsideBounds: window.reorder.getInsertionIndexFromPoint(
                    hitBoxes,
                    { clientX: 50, clientY: 90 },
                    { bounds: { left: 0, top: 0, right: 100, bottom: 80 } },
                ),
            }
        })

        expect(result.outsideWithoutBounds).toBeNull()
        expect(result.beforeFirstInsideBounds).toBe(0)
        expect(result.afterLastInsideBounds).toBe(2)
        expect(result.outsideBounds).toBeNull()
    })
})

test.describe('collision helpers', () => {
    test('detects intersections, centers, and direction-biased closest hit boxes', async ({ page }) => {
        const result = await page.evaluate(() => {
            const hitBoxes = [
                { index: 0, left: 0, top: 0, right: 100, bottom: 40 },
                { index: 1, left: 0, top: 50, right: 100, bottom: 90 },
                { index: 2, left: 0, top: 100, right: 100, bottom: 140 },
            ]

            return {
                intersects: window.reorder.pointerIntersectsHitBox(hitBoxes[0], { clientX: 50, clientY: 20 }),
                misses: window.reorder.pointerIntersectsHitBox(hitBoxes[0], { clientX: 140, clientY: 20 }),
                center: window.reorder.getHitBoxCenter(hitBoxes[1]),
                intersectingIndex: window.reorder.getIntersectingHitBox(hitBoxes, { clientX: 10, clientY: 110 })?.index,
                closestIndex: window.reorder.getClosestHitBoxByCenter(hitBoxes, { clientX: 45, clientY: 76 })?.index,
                biasedDownIndex: window.reorder.getDirectionBiasedHitBox(hitBoxes, { clientX: 50, clientY: 95 }, 'down')
                    ?.index,
                biasedUpIndex: window.reorder.getDirectionBiasedHitBox(hitBoxes, { clientX: 50, clientY: 95 }, 'up')
                    ?.index,
            }
        })

        expect(result.intersects).toBe(true)
        expect(result.misses).toBe(false)
        expect(result.center).toEqual({ clientX: 50, clientY: 70 })
        expect(result.intersectingIndex).toBe(2)
        expect(result.closestIndex).toBe(1)
        expect(result.biasedDownIndex).toBe(2)
        expect(result.biasedUpIndex).toBe(1)
    })

    test('auto-scroller honors axis, custom containers, callbacks, stop, and cleanup', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const parent = document.createElement('div')
            const child = document.createElement('div')
            let scrollFrames = 0

            Object.assign(parent.style, {
                position: 'fixed',
                left: '20px',
                top: '20px',
                width: '120px',
                height: '120px',
                overflow: 'auto',
            })
            Object.assign(child.style, {
                width: '400px',
                height: '400px',
            })

            parent.append(child)
            document.body.append(parent)

            const rect = parent.getBoundingClientRect()
            const scroller = window.reorder.createAutoScroller({
                axis: 'y',
                edgeThreshold: 60,
                maxSpeed: 1000,
                getScrollContainers: () => [parent],
                onScroll: () => {
                    scrollFrames++
                },
            })

            scroller.update({ clientX: rect.right - 2, clientY: rect.bottom - 2 }, child)
            const pendingAfterUpdate = scroller.isScrolling()

            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

            const afterScroll = {
                top: parent.scrollTop,
                left: parent.scrollLeft,
                frames: scrollFrames,
                pending: scroller.isScrolling(),
            }

            scroller.stop()
            const stopped = scroller.isScrolling()
            scroller.cleanup()
            const afterCleanup = scroller.isScrolling()
            parent.remove()

            return { pendingAfterUpdate, afterScroll, stopped, afterCleanup }
        })

        expect(result.pendingAfterUpdate).toBe(true)
        expect(result.afterScroll.top).toBeGreaterThan(0)
        expect(result.afterScroll.left).toBe(0)
        expect(result.afterScroll.frames).toBeGreaterThan(0)
        expect(result.afterScroll.pending).toBe(true)
        expect(result.stopped).toBe(false)
        expect(result.afterCleanup).toBe(false)
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

    test('auto-scrolls configured containers and remeasures while dragging', async ({ page }) => {
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
        await expect
            .poll(async () => Number(await page.locator('#auto-scroll-measures').textContent()))
            .toBeGreaterThan(1)

        await page.mouse.up()
        await expect(page.locator('#auto-scroll-dragging')).toHaveText('no')
    })
})
