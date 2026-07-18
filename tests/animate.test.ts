import {
    animateFromSnapshot,
    captureAnimationSnapshot,
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
})
