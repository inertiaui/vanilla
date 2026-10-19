import {
    animateFromSnapshot,
    captureAnimationSnapshot,
    createLayoutAnimation,
    prefersReducedMotion,
    type AnimationSnapshot,
} from '../src/animate'

const rect = (left: number, top: number): DOMRect => DOMRect.fromRect({ x: left, y: top, width: 20, height: 10 })

const appendElement = () => {
    const element = document.createElement('div')

    document.body.appendChild(element)

    return element
}

const setRect = (element: HTMLElement, value: DOMRect) => {
    element.getBoundingClientRect = vi.fn(() => value)
}

const mockAnimationSupport = () => {
    const animations: Array<Animation & { cancel: ReturnType<typeof vi.fn> }> = []
    const animate = vi.fn(() => {
        const animation = {
            cancel: vi.fn(),
            finished: new Promise<Animation>(() => {}),
        } as Animation & { cancel: ReturnType<typeof vi.fn> }

        animations.push(animation)

        return animation
    })

    Object.defineProperty(Element.prototype, 'animate', {
        configurable: true,
        value: animate,
    })

    return { animate, animations }
}

describe('animation snapshots', () => {
    const originalAnimate = Element.prototype.animate
    const originalMatchMedia = window.matchMedia

    beforeEach(() => {
        document.body.innerHTML = ''
        mockAnimationSupport()

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn(() => ({ matches: false })),
        })
    })

    afterEach(() => {
        if (originalAnimate) {
            Object.defineProperty(Element.prototype, 'animate', {
                configurable: true,
                value: originalAnimate,
            })
        } else {
            delete (Element.prototype as { animate?: Element['animate'] }).animate
        }

        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: originalMatchMedia,
        })

        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('captures connected element rectangles', () => {
        const element = appendElement()
        const disconnected = document.createElement('div')

        setRect(element, rect(12, 24))
        setRect(disconnected, rect(99, 99))

        const snapshot = captureAnimationSnapshot([element, null, disconnected])

        expect(snapshot?.get(element)?.left).toBe(12)
        expect(snapshot?.has(disconnected)).toBe(false)
    })

    it('skips snapshots when reduced motion is preferred', () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn(() => ({ matches: true })),
        })

        expect(prefersReducedMotion()).toBe(true)
        expect(captureAnimationSnapshot([appendElement()])).toBeNull()
    })

    it('animates moved elements from a captured position to their current position', () => {
        const element = appendElement()
        const { animate, animations } = mockAnimationSupport()
        const snapshot: AnimationSnapshot = new Map([[element, rect(40, 30)]])

        setRect(element, rect(10, 20))

        const result = animateFromSnapshot(snapshot, [element], {
            duration: 200,
            easing: 'linear',
            fill: 'none',
        })

        expect(result).toEqual(animations)
        expect(animate).toHaveBeenCalledWith(
            [{ transform: 'translate3d(30px, 10px, 0)' }, { transform: 'translate3d(0, 0, 0)' }],
            {
                duration: 200,
                easing: 'linear',
                fill: 'none',
            },
        )
    })

    it('cancels only its previous snapshot animation for the same element', () => {
        const element = appendElement()
        const { animations } = mockAnimationSupport()
        const snapshot: AnimationSnapshot = new Map([[element, rect(20, 0)]])

        setRect(element, rect(0, 0))

        animateFromSnapshot(snapshot, [element])
        animateFromSnapshot(snapshot, [element])

        expect(animations).toHaveLength(2)
        expect(animations[0].cancel).toHaveBeenCalledTimes(1)
        expect(animations[1].cancel).not.toHaveBeenCalled()
    })

    it('folds the current visual translate into the next snapshot animation', () => {
        const element = appendElement()
        const { animate } = mockAnimationSupport()
        const snapshot: AnimationSnapshot = new Map([[element, rect(20, 20)]])

        setRect(element, rect(10, 10))
        vi.stubGlobal(
            'getComputedStyle',
            vi.fn(() => ({ transform: 'matrix(1, 0, 0, 1, 6, -4)' })),
        )
        vi.stubGlobal(
            'DOMMatrixReadOnly',
            class {
                m41: number
                m42: number

                constructor(transform: string) {
                    const parts =
                        transform
                            .match(/matrix\(([^)]+)\)/)?.[1]
                            ?.split(',')
                            .map((value) => Number(value.trim())) ?? []

                    this.m41 = parts[4] ?? 0
                    this.m42 = parts[5] ?? 0
                }
            },
        )

        animateFromSnapshot(snapshot, [element])

        expect(animate).toHaveBeenCalledWith(
            [{ transform: 'translate3d(16px, 6px, 0)' }, { transform: 'translate3d(0, 0, 0)' }],
            expect.any(Object),
        )
    })

    it('ignores sub-pixel moves and clears a stale snapshot animation', () => {
        const element = appendElement()
        const { animate, animations } = mockAnimationSupport()

        setRect(element, rect(0, 0))

        animateFromSnapshot(new Map([[element, rect(20, 0)]]), [element])
        animateFromSnapshot(new Map([[element, rect(0.2, 0.2)]]), [element])

        expect(animate).toHaveBeenCalledTimes(1)
        expect(animations[0].cancel).toHaveBeenCalledTimes(1)
    })

    it('measures independent elements before starting or cancelling any animations', () => {
        const elements = [appendElement(), appendElement(), appendElement()]
        const snapshot = new Map(elements.map((element) => [element, rect(0, 0)]))
        let writing = false
        let lateReads = 0
        const { animate, animations } = mockAnimationSupport()
        elements.forEach((element) => {
            element.getBoundingClientRect = () => {
                if (writing) lateReads++
                return rect(0, 20)
            }
        })
        // Existing owned animations must also remain untouched during measurement.
        animateFromSnapshot(snapshot, elements)
        animations.forEach((animation) =>
            animation.cancel.mockImplementation(() => {
                writing = true
            }),
        )
        const original = animate.getMockImplementation()!
        animate.mockImplementation(() => {
            writing = true
            return original()
        })
        const result = animateFromSnapshot(snapshot, elements)
        expect(result).toHaveLength(3)
        expect(lateReads).toBe(0)
        expect(animations.slice(0, 3).every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true)
    })

    it('avoids repeating root lookups for sibling animations in a deep tree', () => {
        const { animations } = mockAnimationSupport()
        let parent = appendElement()
        for (let depth = 0; depth < 20; depth++) {
            const child = document.createElement('div')
            parent.append(child)
            parent = child
        }
        const elements = Array.from({ length: 50 }, () => {
            const element = document.createElement('div')
            parent.append(element)
            setRect(element, rect(0, 0))
            return element
        })
        const snapshot: AnimationSnapshot = new Map(elements.map((element) => [element, rect(0, 20)]))
        vi.stubGlobal(
            'getComputedStyle',
            vi.fn(() => ({ transform: 'none' })),
        )
        const roots = vi.spyOn(Node.prototype, 'getRootNode')
        animateFromSnapshot(snapshot, elements)
        expect(animations).toHaveLength(elements.length)
        expect(roots.mock.calls.length).toBeLessThan(elements.length)
    })
})

describe('createLayoutAnimation', () => {
    const originalAnimate = Element.prototype.animate
    const originalMatchMedia = window.matchMedia
    let reducedMotion = false
    let animations: Array<Animation & { cancel: ReturnType<typeof vi.fn>; finish: () => void }> = []

    beforeEach(() => {
        document.body.innerHTML = ''
        reducedMotion = false
        animations = []
        Object.defineProperty(Element.prototype, 'animate', {
            configurable: true,
            value: vi.fn(() => {
                let settle: (animation: Animation) => void = () => {}
                let fail: (error: Error) => void = () => {}
                const animation = {
                    finished: new Promise<Animation>((resolve, reject) => {
                        settle = resolve
                        fail = reject
                    }),
                } as Animation & { cancel: ReturnType<typeof vi.fn>; finish: () => void }
                animation.cancel = vi.fn(() => fail(new Error('canceled')))
                animation.finish = () => settle(animation)
                animations.push(animation)

                return animation
            }),
        })
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn(() => ({ matches: reducedMotion })),
        })
    })

    afterEach(() => {
        if (originalAnimate) {
            Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: originalAnimate })
        } else {
            delete (Element.prototype as { animate?: Element['animate'] }).animate
        }
        Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    // A plain list whose second item moves down by 30px between the snapshot and the next render.
    const list = () => {
        const items = [appendElement(), appendElement()]
        setRect(items[0], rect(0, 0))
        setRect(items[1], rect(0, 30))
        const snapshot = captureAnimationSnapshot(items)
        setRect(items[1], rect(0, 60))

        return { items, snapshot }
    }

    const scheduler = () => {
        const runs: Array<() => void> = []
        const cancels: Array<ReturnType<typeof vi.fn>> = []
        const schedule = vi.fn((run: () => void) => {
            runs.push(run)
            const cancel = vi.fn()
            cancels.push(cancel)

            return cancel
        })

        return { schedule, runs, cancels }
    }

    const settled = () => new Promise((resolve) => setTimeout(resolve))

    it('animates the elements read once the renderer has updated, then reports the start and the settle', async () => {
        const { items, snapshot } = list()
        const { schedule, runs } = scheduler()
        const calls: string[] = []
        const getElements = vi.fn(() => (calls.push('elements'), items))
        const controller = createLayoutAnimation({ schedule, duration: 100 })

        controller.animate(snapshot, getElements, {
            onStart: (started) => calls.push(`start:${started.length}`),
            onSettle: () => calls.push('settle'),
        })
        expect(getElements).not.toHaveBeenCalled()
        expect(Element.prototype.animate).not.toHaveBeenCalled()

        runs[0]()
        expect(calls).toEqual(['elements', 'start:1'])
        expect(Element.prototype.animate).toHaveBeenCalledWith(
            [{ transform: 'translate3d(0px, -30px, 0)' }, { transform: 'translate3d(0, 0, 0)' }],
            expect.objectContaining({ duration: 100 }),
        )

        await settled()
        expect(calls).toEqual(['elements', 'start:1'])
        animations[0].finish()
        await settled()
        expect(calls).toEqual(['elements', 'start:1', 'settle'])
    })

    it('waits for the next animation frame by default', () => {
        const { items, snapshot } = list()
        const frames: FrameRequestCallback[] = []
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
        )
        const onStart = vi.fn()

        createLayoutAnimation().animate(snapshot, () => items, { onStart })
        expect(onStart).not.toHaveBeenCalled()
        frames[0](0)
        expect(onStart).toHaveBeenCalledWith([animations[0]])
    })

    it('drops runs that have not started and cancels running animations, which still settle', async () => {
        const { items, snapshot } = list()
        const { schedule, runs, cancels } = scheduler()
        const onStart = vi.fn()
        const onSettle = vi.fn()
        const controller = createLayoutAnimation({ schedule })

        controller.animate(snapshot, () => items, { onStart, onSettle })
        controller.cancel()
        expect(cancels[0]).toHaveBeenCalledOnce()
        await settled()
        expect(onStart).not.toHaveBeenCalled()
        expect(onSettle).not.toHaveBeenCalled()

        controller.animate(snapshot, () => items, { onStart, onSettle })
        runs[1]()
        controller.cancel()
        expect(animations[0].cancel).toHaveBeenCalled()
        await settled()
        expect(onStart).toHaveBeenCalledOnce()
        expect(onSettle).toHaveBeenCalledOnce()
    })

    it('settles a run whose animations a later run takes over', async () => {
        const { items, snapshot } = list()
        const { schedule, runs } = scheduler()
        const first = vi.fn()
        const second = vi.fn()
        const controller = createLayoutAnimation({ schedule })

        controller.animate(snapshot, () => items, { onSettle: first })
        runs[0]()
        controller.animate(captureAnimationSnapshot(items), () => items, { onSettle: second })
        setRect(items[1], rect(0, 90))
        runs[1]()
        await settled()
        expect(first).toHaveBeenCalledOnce()
        expect(second).not.toHaveBeenCalled()
    })

    it('settles at once without motion', async () => {
        reducedMotion = true
        const { items, snapshot } = list()
        const { schedule, runs } = scheduler()
        const onStart = vi.fn()
        const onSettle = vi.fn()

        createLayoutAnimation({ schedule }).animate(snapshot, () => items, { onStart, onSettle })
        runs[0]()
        expect(onStart).toHaveBeenCalledWith([])
        await settled()
        expect(onSettle).toHaveBeenCalledOnce()
        expect(Element.prototype.animate).not.toHaveBeenCalled()
    })

    it('stops everything silently on cleanup and ignores later runs', async () => {
        const { items, snapshot } = list()
        const { schedule, runs, cancels } = scheduler()
        const onStart = vi.fn()
        const onSettle = vi.fn()
        const controller = createLayoutAnimation({ schedule })

        controller.animate(snapshot, () => items, { onStart, onSettle })
        runs[0]()
        controller.animate(snapshot, () => items, { onStart, onSettle })
        controller.cleanup()
        expect(animations[0].cancel).toHaveBeenCalled()
        expect(cancels[1]).toHaveBeenCalledOnce()
        controller.animate(snapshot, () => items, { onStart, onSettle })
        runs[1]?.()
        await settled()
        expect(schedule).toHaveBeenCalledTimes(2)
        expect(onStart).toHaveBeenCalledOnce()
        expect(onSettle).not.toHaveBeenCalled()
    })

    it('cancels a frame whose handle is 0', () => {
        const cancelAnimationFrame = vi.fn()
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn(() => 0),
        )
        vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
        const { items, snapshot } = list()
        const controller = createLayoutAnimation()

        controller.animate(snapshot, () => items)
        controller.cancel()
        expect(cancelAnimationFrame).toHaveBeenCalledWith(0)
    })

    it('runs with a synchronous scheduler and one that cannot cancel', async () => {
        const { items, snapshot } = list()
        const onSettle = vi.fn()
        createLayoutAnimation({ schedule: (run) => run() }).animate(snapshot, () => items, { onSettle })
        expect(animations).toHaveLength(1)

        // A run the scheduler starts after a cancel stays dropped.
        const later: Array<() => void> = []
        const controller = createLayoutAnimation({ schedule: (run) => void later.push(run) })
        const onStart = vi.fn()
        controller.animate(snapshot, () => items, { onStart })
        controller.cancel()
        later[0]()
        expect(onStart).not.toHaveBeenCalled()
        animations[0].finish()
        await settled()
        expect(onSettle).toHaveBeenCalledOnce()
    })

    it('stays consistent when callbacks start or cancel runs and when reading elements throws', async () => {
        const { items, snapshot } = list()
        const { schedule, runs } = scheduler()
        const controller = createLayoutAnimation({ schedule })
        const onSettle = vi.fn(() => controller.cancel())

        controller.animate(snapshot, () => items, {
            onStart: () => controller.animate(snapshot, () => items, { onSettle }),
        })
        runs[0]()
        expect(schedule).toHaveBeenCalledTimes(2)
        runs[1]()
        animations[1].finish()
        await settled()
        expect(onSettle).toHaveBeenCalledOnce()

        controller.animate(snapshot, () => {
            throw new Error('unmounted')
        })
        expect(() => runs[2]()).toThrow('unmounted')
        const onStart = vi.fn()
        controller.animate(snapshot, () => items, { onStart })
        runs[3]()
        expect(onStart).toHaveBeenCalledOnce()
    })

    it('releases a run whose scheduler throws', () => {
        const { items, snapshot } = list()
        const kept: Array<() => void> = []
        const onStart = vi.fn()
        const controller = createLayoutAnimation({
            schedule: (run) => {
                kept.push(run)
                throw new Error('no frames')
            },
        })

        expect(() => controller.animate(snapshot, () => items, { onStart })).toThrow('no frames')
        kept[0]()
        controller.cancel()
        expect(onStart).not.toHaveBeenCalled()
        expect(Element.prototype.animate).not.toHaveBeenCalled()
    })
})
