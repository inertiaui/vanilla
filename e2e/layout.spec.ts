import { test, expect } from './test'

declare global {
    interface Window {
        layout: {
            captureAnimationSnapshot: typeof import('../src/animate').captureAnimationSnapshot
            createLayoutAnimation: typeof import('../src/animate').createLayoutAnimation
            getReorderOffsets: typeof import('../src/reorder').getReorderOffsets
            getScrollableAncestors: typeof import('../src/reorder').getScrollableAncestors
        }
    }
}

test.beforeEach(async ({ page }) => {
    await page.waitForFunction(() => window.layout !== undefined)
})

test('finds scrollable ancestors along an axis from inside a shadow root', async ({ page }) => {
    const ancestors = await page.evaluate(() => {
        const item = document.querySelector('#host')!.shadowRoot!.querySelector('span')!
        const name = (container: Element | Window) => (container === window ? 'window' : (container as Element).id)

        return (['both', 'x', 'y'] as const).map((axis) => window.layout.getScrollableAncestors(item, axis).map(name))
    })

    expect(ancestors).toEqual([
        ['horizontal', 'vertical', 'window'],
        ['horizontal', 'window'],
        ['vertical', 'window'],
    ])
})

test('offsets match where a flex layout with gaps puts the reordered items', async ({ page }) => {
    const results = await page.evaluate(() => {
        const check = (list: HTMLElement, order: number[], options: { axis: 'x' | 'y'; reverse?: boolean }) => {
            const items = Array.from(list.children) as HTMLElement[]
            const before = items.map((item) => item.getBoundingClientRect())
            const offsets = window.layout.getReorderOffsets(before, order, options)
            order.forEach((index) => list.append(items[index]))
            const edge = options.axis === 'x' ? 'left' : 'top'

            return items.map(
                (item, index) =>
                    Math.round((item.getBoundingClientRect()[edge] - before[index][edge] - offsets[index]) * 100) / 100,
            )
        }

        return [
            check(document.querySelector('#column')!, [2, 0, 1], { axis: 'y' }),
            check(document.querySelector('#row')!, [1, 2, 0], { axis: 'x', reverse: true }),
        ]
    })

    expect(results).toEqual([
        [0, 0, 0],
        [0, 0, 0],
    ])
})

test('animates a reordered list and settles once the animations finish', async ({ page }) => {
    const result = await page.evaluate(
        () =>
            new Promise<{ started: number; running: boolean }>((resolve) => {
                const list = document.querySelector<HTMLElement>('#column')!
                const items = Array.from(list.children) as HTMLElement[]
                const snapshot = window.layout.captureAnimationSnapshot(items)
                let started: Animation[] = []

                list.append(items[0])
                window.layout.createLayoutAnimation({ duration: 60 }).animate(snapshot, () => items, {
                    onStart: (animations) => (started = animations),
                    onSettle: () =>
                        resolve({
                            started: started.length,
                            running: started.some((animation) => animation.playState === 'running'),
                        }),
                })
            }),
    )

    expect(result).toEqual({ started: 3, running: false })
})

test('settles at once when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const started = await page.evaluate(
        () =>
            new Promise<number>((resolve) => {
                const items = Array.from(document.querySelector('#column')!.children) as HTMLElement[]
                let count = -1

                window.layout
                    .createLayoutAnimation()
                    .animate(window.layout.captureAnimationSnapshot(items), () => items, {
                        onStart: (animations) => (count = animations.length),
                        onSettle: () => resolve(count),
                    })
            }),
    )

    expect(started).toBe(0)
})
