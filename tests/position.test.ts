function rect(left: number, top: number, right: number, bottom: number): DOMRect {
    return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }
}

function supportsNonWebKitCss(property: string): boolean {
    return property !== '-webkit-backdrop-filter'
}

describe('positionTopLayerPopover', () => {
    afterEach(() => {
        document.body.innerHTML = ''
        vi.resetModules()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('falls back to manual positioning when CSS anchor sizing still overflows the viewport', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(supportsNonWebKitCss),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const { positionTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')

        reference.getBoundingClientRect = () => rect(32, 430, 252, 470)
        Object.defineProperty(popover, 'scrollWidth', { configurable: true, value: 332 })
        Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 480 })
        popover.getBoundingClientRect = () => {
            const hasAnchorClass = Array.from(popover.classList).some((className) =>
                className.startsWith('iui-anchor-'),
            )

            if (hasAnchorClass) {
                return rect(32, -42, 364, 438)
            }

            const height = popover.style.maxHeight.endsWith('px') ? Number.parseFloat(popover.style.maxHeight) : 480

            return rect(0, 0, 332, height)
        }

        document.body.append(reference, popover)

        const result = positionTopLayerPopover(reference, popover, {
            placement: 'bottom-start',
            offset: 4,
            flip: true,
            viewportMargin: 8,
        })

        expect(result.placement).toBe('top-start')
        expect(result.y).toBe(8)
        expect(popover.style.top).toBe('8px')
        expect(popover.style.left).toBe('32px')
        expect(popover.style.maxHeight).toBe('418px')
        expect(reference.style.getPropertyValue('anchor-name')).toBe('')
        expect(popover.style.getPropertyValue('position-anchor')).toBe('')
        expect(Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-'))).toBe(false)
    })

    it('keeps CSS top-layer anchoring available for non-WebKit engines', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(supportsNonWebKitCss),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const { positionTopLayerPopover, supportsTopLayerAnchorPositioning } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')

        reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        Object.defineProperty(popover, 'scrollWidth', { configurable: true, value: 260 })
        Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 280 })
        popover.getBoundingClientRect = () => {
            const width = popover.style.width.endsWith('px') ? Number.parseFloat(popover.style.width) : 260
            const height = popover.style.maxHeight.endsWith('px')
                ? Math.min(280, Number.parseFloat(popover.style.maxHeight))
                : 280

            return rect(0, 0, width, height)
        }

        document.body.append(reference, popover)

        expect(supportsTopLayerAnchorPositioning()).toBe(true)

        const result = positionTopLayerPopover(reference, popover, {
            placement: 'bottom-start',
            offset: 4,
            matchReferenceWidth: true,
            viewportMargin: 8,
        })

        expect(result.placement).toBe('bottom-start')
        expect(popover.style.top).toBe('')
        expect(popover.style.left).toBe('')
        const anchorClass = Array.from(popover.classList).find((className) => className.startsWith('iui-anchor-'))
        const anchorName = (reference.style as any).anchorName || reference.style.getPropertyValue('anchor-name')
        const positionAnchor =
            (popover.style as any).positionAnchor || popover.style.getPropertyValue('position-anchor')
        expect(anchorName).toMatch(/^--iui-anchor-/)
        expect(positionAnchor).toBe(anchorName)
        expect(anchorClass).toBeTruthy()
    })

    it('uses manual top-layer positioning for WebKit engines', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(() => true),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const { positionTopLayerPopover, supportsTopLayerAnchorPositioning } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')

        reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        Object.defineProperty(popover, 'scrollWidth', { configurable: true, value: 260 })
        Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 280 })
        popover.getBoundingClientRect = () => rect(0, 0, 260, 280)

        document.body.append(reference, popover)

        expect(supportsTopLayerAnchorPositioning()).toBe(false)

        const result = positionTopLayerPopover(reference, popover, {
            placement: 'bottom-start',
            offset: 4,
            matchReferenceWidth: true,
            viewportMargin: 8,
        })

        expect(result.placement).toBe('bottom-start')
        expect(popover.style.top).toBe('164px')
        expect(popover.style.left).toBe('80px')
        expect(popover.style.width).toBe('220px')
        expect(reference.style.getPropertyValue('anchor-name')).toBe('')
        expect(popover.style.getPropertyValue('position-anchor')).toBe('')
        expect(Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-'))).toBe(false)
    })

    it('keeps browser-anchored top-layer popovers cheap during scroll', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn((property: string, value?: string) => {
                if (property === '-webkit-backdrop-filter') {
                    return false
                }

                if (property === 'max-height' && value === 'stretch') {
                    return false
                }

                return true
            }),
        })

        const rafCallbacks: FrameRequestCallback[] = []
        const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            rafCallbacks.push(callback)

            return rafCallbacks.length
        })
        const visualViewport = {
            offsetTop: 0,
            offsetLeft: 0,
            width: 800,
            height: 600,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }
        const resizeObserver = {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
        }
        const addEventListener = vi.spyOn(window, 'addEventListener')
        const removeEventListener = vi.spyOn(window, 'removeEventListener')
        let resizeCallback: ResizeObserverCallback | undefined

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal(
            'ResizeObserver',
            vi.fn(function ResizeObserverMock(callback: ResizeObserverCallback) {
                resizeCallback = callback

                return resizeObserver
            }),
        )

        const { autoUpdateTopLayerPopover, supportsTopLayerAnchorPositioning } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')
        reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        popover.classList.add('iui-anchor-test')
        const update = vi.fn(() => {
            popover.classList.remove('iui-anchor-test')
        })

        expect(supportsTopLayerAnchorPositioning()).toBe(true)

        const cleanup = autoUpdateTopLayerPopover(reference, popover, update)

        expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(addEventListener).toHaveBeenCalledWith(
            'scroll',
            expect.any(Function),
            expect.objectContaining({ capture: true, passive: true }),
        )
        expect(visualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(visualViewport.addEventListener).toHaveBeenCalledWith(
            'scroll',
            expect.any(Function),
            expect.objectContaining({ passive: true }),
        )
        expect(resizeObserver.observe).toHaveBeenCalledWith(reference)
        expect(resizeObserver.observe).not.toHaveBeenCalledWith(popover)

        const scrollHandler = addEventListener.mock.calls.find(([eventName]) => eventName === 'scroll')?.[1] as
            | EventListener
            | undefined

        expect(scrollHandler).toBeTruthy()

        requestAnimationFrame.mockClear()
        scrollHandler?.(new Event('scroll'))
        expect(requestAnimationFrame).not.toHaveBeenCalled()

        requestAnimationFrame.mockClear()
        resizeCallback?.([{ target: popover } as ResizeObserverEntry], {} as ResizeObserver)
        expect(requestAnimationFrame).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()

        const resizeHandler = addEventListener.mock.calls.find(([eventName]) => eventName === 'resize')?.[1] as
            | EventListener
            | undefined

        expect(resizeHandler).toBeTruthy()

        requestAnimationFrame.mockClear()
        resizeHandler?.(new Event('resize'))
        expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

        rafCallbacks[0]?.(0)

        expect(update).toHaveBeenCalledTimes(1)
        expect(resizeObserver.observe).toHaveBeenCalledWith(popover)

        requestAnimationFrame.mockClear()
        scrollHandler?.(new Event('scroll'))
        expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

        cleanup()

        expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true)
        expect(visualViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(visualViewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    })

    it('parks anchored top-layer popovers while the reference is outside the viewport', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(supportsNonWebKitCss),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const rafCallbacks: FrameRequestCallback[] = []
        const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            rafCallbacks.push(callback)

            return rafCallbacks.length
        })
        const resizeObserver = {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
        }
        const observeIntersection = vi.fn()
        const disconnectIntersection = vi.fn()
        let intersectionCallback: IntersectionObserverCallback | undefined
        const addEventListener = vi.spyOn(window, 'addEventListener')

        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal(
            'ResizeObserver',
            vi.fn(function ResizeObserverMock() {
                return resizeObserver
            }),
        )
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(function IntersectionObserverMock(callback: IntersectionObserverCallback) {
                intersectionCallback = callback

                return {
                    observe: observeIntersection,
                    disconnect: disconnectIntersection,
                }
            }),
        )

        const { autoUpdateTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')
        const update = vi.fn(() => {
            reference.style.setProperty('anchor-name', '--iui-anchor-restored')
            popover.style.setProperty('position-anchor', '--iui-anchor-restored')
            popover.classList.add('iui-anchor-restored')
        })

        reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        reference.style.setProperty('anchor-name', '--iui-anchor-test')
        popover.style.setProperty('position-anchor', '--iui-anchor-test')
        popover.style.setProperty('transition', 'opacity 75ms ease')
        popover.style.setProperty('animation', 'iui-test 75ms ease')
        popover.classList.add('iui-anchor-test')

        const cleanup = autoUpdateTopLayerPopover(reference, popover, update)

        expect(observeIntersection).toHaveBeenCalledWith(reference)
        expect(addEventListener).toHaveBeenCalledWith(
            'scroll',
            expect.any(Function),
            expect.objectContaining({ capture: true, passive: true }),
        )
        expect(resizeObserver.observe).toHaveBeenCalledWith(reference)
        expect(resizeObserver.observe).not.toHaveBeenCalledWith(popover)

        intersectionCallback?.(
            [{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        )

        expect(update).not.toHaveBeenCalled()
        expect(popover.style.visibility).toBe('hidden')
        expect(popover.style.transition).toBe('none')
        expect(popover.style.getPropertyPriority('transition')).toBe('important')
        expect(popover.style.animation).toBe('none')
        expect(popover.style.getPropertyPriority('animation')).toBe('important')
        expect(popover.hasAttribute('data-inertiaui-top-layer-parked')).toBe(true)
        expect(reference.style.getPropertyValue('anchor-name')).toBe('--iui-anchor-test')
        expect(popover.style.getPropertyValue('position-anchor')).toBe('--iui-anchor-test')
        expect(Array.from(popover.classList).some((className) => className === 'iui-anchor-test')).toBe(true)

        requestAnimationFrame.mockClear()
        intersectionCallback?.(
            [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        )

        expect(popover.style.visibility).toBe('hidden')
        expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

        rafCallbacks.at(-1)?.(0)

        expect(update).toHaveBeenCalledTimes(1)
        expect(popover.style.visibility).toBe('')
        expect(popover.style.transition).toBe('none')
        expect(popover.style.animation).toBe('none')
        expect(popover.hasAttribute('data-inertiaui-top-layer-parked')).toBe(true)

        rafCallbacks.at(-1)?.(16)

        expect(popover.style.transition).toBe('opacity 75ms ease')
        expect(popover.style.animation).toBe('iui-test 75ms ease')
        expect(popover.hasAttribute('data-inertiaui-top-layer-parked')).toBe(false)

        cleanup()
        expect(disconnectIntersection).toHaveBeenCalled()
    })

    it('parks anchored top-layer popovers during scroll before scheduling an update', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(supportsNonWebKitCss),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const requestAnimationFrame = vi.fn()
        const addEventListener = vi.spyOn(window, 'addEventListener')
        const removeEventListener = vi.spyOn(window, 'removeEventListener')
        let referenceRect = rect(80, 120, 300, 160)

        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal(
            'ResizeObserver',
            vi.fn(function ResizeObserverMock() {
                return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
            }),
        )
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(function IntersectionObserverMock() {
                return { observe: vi.fn(), disconnect: vi.fn() }
            }),
        )

        const { autoUpdateTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')
        const update = vi.fn()

        reference.getBoundingClientRect = () => referenceRect
        reference.style.setProperty('anchor-name', '--iui-anchor-test')
        popover.style.setProperty('position-anchor', '--iui-anchor-test')
        popover.style.setProperty('transition', 'opacity 75ms ease')
        popover.classList.add('iui-anchor-test')

        const cleanup = autoUpdateTopLayerPopover(reference, popover, update)

        expect(addEventListener).toHaveBeenCalledWith(
            'scroll',
            expect.any(Function),
            expect.objectContaining({ capture: true, passive: true }),
        )

        const scrollHandler = addEventListener.mock.calls.find(([eventName]) => eventName === 'scroll')?.[1] as
            | EventListener
            | undefined

        expect(scrollHandler).toBeTruthy()

        referenceRect = rect(80, -120, 300, -80)
        scrollHandler?.(new Event('scroll'))

        expect(update).not.toHaveBeenCalled()
        expect(requestAnimationFrame).not.toHaveBeenCalled()
        expect(popover.style.visibility).toBe('hidden')
        expect(popover.style.transition).toBe('none')
        expect(popover.style.getPropertyPriority('transition')).toBe('important')
        expect(popover.hasAttribute('data-inertiaui-top-layer-parked')).toBe(true)
        expect(reference.style.getPropertyValue('anchor-name')).toBe('--iui-anchor-test')
        expect(popover.style.getPropertyValue('position-anchor')).toBe('--iui-anchor-test')
        expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true)

        cleanup()
    })

    it('parks manually positioned top-layer popovers while the reference is outside the viewport', async () => {
        // Without CSS anchor positioning the popover is placed by JS, so it keeps
        // tracking the reference off-screen. It still renders in the top layer and
        // would scroll across fixed page chrome, so it has to park just the same.
        vi.stubGlobal('CSS', {
            supports: vi.fn(() => false),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const rafCallbacks: FrameRequestCallback[] = []
        const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            rafCallbacks.push(callback)

            return rafCallbacks.length
        })
        const observeIntersection = vi.fn()
        let intersectionCallback: IntersectionObserverCallback | undefined
        const removeEventListener = vi.spyOn(window, 'removeEventListener')

        vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal(
            'ResizeObserver',
            vi.fn(function ResizeObserverMock() {
                return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
            }),
        )
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(function IntersectionObserverMock(callback: IntersectionObserverCallback) {
                intersectionCallback = callback

                return { observe: observeIntersection, disconnect: vi.fn() }
            }),
        )

        const { autoUpdateTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')
        const update = vi.fn()

        reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        popover.style.setProperty('transition', 'opacity 75ms ease')

        const cleanup = autoUpdateTopLayerPopover(reference, popover, update)

        // JS positioning needs scroll updates, unlike the browser-anchored path.
        expect(observeIntersection).toHaveBeenCalledWith(reference)
        expect(popover.style.visibility).toBe('')

        intersectionCallback?.(
            [{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        )

        expect(popover.style.visibility).toBe('hidden')
        expect(popover.style.transition).toBe('none')
        expect(popover.style.getPropertyPriority('transition')).toBe('important')
        // Parked popovers stop paying for scroll work; the observer wakes them.
        expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true)

        requestAnimationFrame.mockClear()
        intersectionCallback?.(
            [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        )

        // Stays hidden until the reposition lands, so it never paints a stale frame.
        expect(popover.style.visibility).toBe('hidden')
        expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

        rafCallbacks.at(-1)?.(0)

        expect(update).toHaveBeenCalled()
        expect(popover.style.visibility).toBe('')
        expect(popover.style.transition).toBe('none')

        rafCallbacks.at(-1)?.(16)

        expect(popover.style.transition).toBe('opacity 75ms ease')

        cleanup()
    })

    it('preserves an author-set visibility when parking and restoring', async () => {
        vi.stubGlobal('CSS', { supports: vi.fn(() => false) })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const rafCallbacks: FrameRequestCallback[] = []
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((callback: FrameRequestCallback) => {
                rafCallbacks.push(callback)

                return rafCallbacks.length
            }),
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal(
            'ResizeObserver',
            vi.fn(function ResizeObserverMock() {
                return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
            }),
        )
        let intersectionCallback: IntersectionObserverCallback | undefined
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(function IntersectionObserverMock(callback: IntersectionObserverCallback) {
                intersectionCallback = callback

                return { observe: vi.fn(), disconnect: vi.fn() }
            }),
        )

        const { autoUpdateTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')

        reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        popover.style.setProperty('visibility', 'visible')
        popover.style.setProperty('transition', 'opacity 75ms ease')

        const cleanup = autoUpdateTopLayerPopover(reference, popover, vi.fn())

        intersectionCallback?.(
            [{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        )
        expect(popover.style.visibility).toBe('hidden')

        intersectionCallback?.(
            [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
            {} as IntersectionObserver,
        )
        rafCallbacks.at(-1)?.(0)

        // Restored to the author's value, not blanked.
        expect(popover.style.visibility).toBe('visible')
        expect(popover.style.transition).toBe('none')

        cleanup()

        expect(popover.style.transition).toBe('opacity 75ms ease')
        expect(popover.hasAttribute('data-inertiaui-top-layer-parked')).toBe(false)
    })

    it('falls back to manual positioning when flip fallbacks are unsupported', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn((property: string, value?: string) => {
                if ((property === 'position-try-fallbacks' || property === 'position-try') && value === 'flip-block') {
                    return false
                }

                return true
            }),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const { computePosition } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')
        const anchoredPopover = document.createElement('div')

        reference.getBoundingClientRect = () => rect(100, 560, 200, 590)
        popover.getBoundingClientRect = () => rect(0, 0, 180, 100)
        anchoredPopover.getBoundingClientRect = () => rect(0, 0, 180, 100)
        document.body.append(reference, popover, anchoredPopover)

        computePosition(reference, popover, { placement: 'bottom-start', flip: true })

        expect(popover.style.position).toBe('fixed')
        expect(popover.style.top).not.toBe('')
        expect(popover.style.left).not.toBe('')
        expect(Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-'))).toBe(false)

        computePosition(reference, anchoredPopover, { placement: 'bottom-start', flip: false })

        expect(anchoredPopover.style.top).toBe('')
        expect(anchoredPopover.style.left).toBe('')
        expect(Array.from(anchoredPopover.classList).some((className) => className.startsWith('iui-anchor-'))).toBe(
            true,
        )
    })

    it('works when ResizeObserver is unavailable', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(() => false),
        })
        vi.stubGlobal('ResizeObserver', undefined)

        const { autoUpdate, autoUpdateTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')

        const cleanupAuto = autoUpdate(reference, popover, vi.fn())
        const cleanupTopLayer = autoUpdateTopLayerPopover(reference, popover, vi.fn())

        cleanupAuto()
        cleanupTopLayer()
    })

    it('temporarily unobserves the floating element during resize updates', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(() => false),
        })

        const rafCallbacks: FrameRequestCallback[] = []
        const calls: string[] = []
        const observe = vi.fn((target: Element) => {
            if (target === popover) {
                calls.push('observe')
            }
        })
        const unobserve = vi.fn()
        const disconnect = vi.fn()
        let resizeCallback: ResizeObserverCallback | undefined

        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((callback: FrameRequestCallback) => {
                rafCallbacks.push(callback)

                return rafCallbacks.length
            }),
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        vi.stubGlobal(
            'ResizeObserver',
            vi.fn(function ResizeObserverMock(callback: ResizeObserverCallback) {
                resizeCallback = callback

                return { observe, unobserve, disconnect }
            }),
        )

        const { autoUpdateTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')
        reference.getBoundingClientRect = () => rect(80, 120, 300, 160)
        const update = vi.fn(() => {
            calls.push('update')
        })

        const cleanup = autoUpdateTopLayerPopover(reference, popover, update)

        expect(observe).toHaveBeenCalledWith(reference)
        expect(observe).toHaveBeenCalledWith(popover)

        observe.mockClear()
        calls.length = 0

        resizeCallback?.([{ target: reference } as ResizeObserverEntry], {} as ResizeObserver)

        expect(unobserve).toHaveBeenCalledWith(popover)
        expect(rafCallbacks).toHaveLength(2)

        rafCallbacks[0]?.(0)
        expect(update).toHaveBeenCalledTimes(1)
        expect(observe).not.toHaveBeenCalled()

        rafCallbacks[1]?.(0)
        expect(observe).toHaveBeenLastCalledWith(popover)
        expect(calls).toEqual(['update', 'observe'])

        cleanup()
        expect(disconnect).toHaveBeenCalled()
    })
})
