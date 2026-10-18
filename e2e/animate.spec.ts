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

    for (const tree of ['light', 'shadow', 'slot'] as const) {
        test(`preserves parent-first snapshot measurements for ${tree} descendants`, async ({ page }) => {
            const result = await page.evaluate(async (tree) => {
                const modulePath = '/src/index.ts'
                const { captureAnimationSnapshot, animateFromSnapshot } = await import(modulePath)
                const container = document.createElement('div')
                container.style.cssText = 'position:fixed;top:0;left:0'
                const parent = document.createElement('div')
                const child = document.createElement('div')
                child.style.cssText = 'width:20px;height:20px'
                document.body.append(container)
                if (tree === 'slot') {
                    const host = document.createElement('div')
                    container.append(host)
                    host.attachShadow({ mode: 'open' }).append(parent)
                    parent.append(document.createElement('slot'))
                    host.append(child)
                } else {
                    container.append(parent)
                    if (tree === 'shadow') parent.attachShadow({ mode: 'open' }).append(child)
                    else parent.append(child)
                }
                const snapshot = captureAnimationSnapshot([parent, child])
                const before = child.getBoundingClientRect().top
                container.style.paddingTop = '20px'
                const animations = animateFromSnapshot(snapshot, [parent, child], { duration: 10000 })
                const result = {
                    count: animations.length,
                    childAnimations: child.getAnimations().length,
                    childOffset: child.getBoundingClientRect().top - before,
                }
                animations.forEach((animation: Animation) => animation.cancel())
                container.remove()
                return result
            }, tree)
            expect(result.count).toBe(1)
            expect(result.childAnimations).toBe(0)
            expect(result.childOffset).toBeCloseTo(0, 3)
        })
    }

    test('preserves sequential handling of repeated snapshot elements', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const modulePath = '/src/index.ts'
            const { captureAnimationSnapshot, animateFromSnapshot } = await import(modulePath)
            const element = document.createElement('div')
            element.style.cssText = 'position:fixed;top:0;left:0;width:20px;height:20px'
            document.body.append(element)
            const snapshot = captureAnimationSnapshot([element])
            element.style.top = '20px'
            const animations = animateFromSnapshot(snapshot, [element, element], {
                duration: 10000,
                includeCurrentTransform: false,
            })
            const result = {
                count: animations.length,
                active: element.getAnimations().length,
                cancelled: animations[0].playState === 'idle',
                top: element.getBoundingClientRect().top,
            }
            element.remove()
            return result
        })
        expect(result).toEqual({ count: 1, active: 0, cancelled: true, top: 20 })
    })

    test('restarts interrupted sibling animations without jumping or cancelling consumer animations', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const modulePath = '/src/index.ts'
            const { captureAnimationSnapshot, animateFromSnapshot } = await import(modulePath)
            const container = document.createElement('div')
            container.style.cssText = 'position:fixed;top:0;left:0'
            const elements = Array.from({ length: 3 }, () => {
                const element = document.createElement('div')
                element.style.cssText = 'width:20px;height:20px'
                container.append(element)
                return element
            })
            document.body.append(container)
            const unrelated = elements[0].animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 10000 })
            unrelated.pause()
            const firstSnapshot = captureAnimationSnapshot(elements)
            container.style.paddingTop = '20px'
            const first = animateFromSnapshot(firstSnapshot, elements, { duration: 1000, easing: 'linear' })
            first.forEach((animation: Animation) => {
                animation.pause()
                animation.currentTime = 500
            })
            const before = elements.map((element) => element.getBoundingClientRect().top)
            const secondSnapshot = captureAnimationSnapshot(elements)
            container.style.paddingTop = '40px'
            const second = animateFromSnapshot(secondSnapshot, elements, { duration: 1000, easing: 'linear' })
            second.forEach((animation: Animation) => {
                animation.pause()
                animation.currentTime = 0
            })
            const start = elements.map((element) => element.getBoundingClientRect().top)
            second.forEach((animation: Animation) => animation.finish())
            const final = elements.map((element) => element.getBoundingClientRect().top)
            const result = {
                before,
                start,
                final,
                oldCancelled: first.every((animation: Animation) => animation.playState === 'idle'),
                unrelatedState: unrelated.playState,
            }
            second.forEach((animation: Animation) => animation.cancel())
            unrelated.cancel()
            container.remove()
            return result
        })
        expect(result.oldCancelled).toBe(true)
        expect(result.unrelatedState).toBe('paused')
        result.start.forEach((top: number, index: number) => expect(top).toBeCloseTo(result.before[index], 3))
        expect(result.final).toEqual([40, 60, 80])
    })
})
