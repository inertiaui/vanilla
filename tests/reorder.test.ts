import {
    createAutoScroller,
    createPointerReorder,
    findReorderHandle,
    getClosestHitBoxByCenter,
    getDirectionBiasedHitBox,
    getHitBoxCenter,
    getInsertionIndexFromPoint,
    getIntersectingHitBox,
    pointerIntersectsHitBox,
    REORDERABLE_LIST_HANDLE_ATTRIBUTE,
    type ReorderHitBox,
} from '../src/reorder'

function makeEvent(
    type: string,
    path: EventTarget[],
    currentTarget: EventTarget | null,
    pointer: Partial<PointerEvent> = {},
): PointerEvent {
    const event = new Event(type, { bubbles: true, cancelable: true, composed: true }) as PointerEvent

    Object.defineProperties(event, {
        target: { value: path[0], configurable: true },
        currentTarget: { value: currentTarget, configurable: true },
        composedPath: { value: () => path, configurable: true },
        button: { value: pointer.button ?? 0, configurable: true },
        isPrimary: { value: pointer.isPrimary ?? true, configurable: true },
        pointerId: { value: pointer.pointerId ?? 1, configurable: true },
        clientX: { value: pointer.clientX ?? 10, configurable: true },
        clientY: { value: pointer.clientY ?? 10, configurable: true },
    })

    return event
}

function rect(left: number, top: number, right: number, bottom: number): DOMRect {
    return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }
}

describe('reorder collision helpers', () => {
    const hitBoxes: ReorderHitBox[] = [
        { index: 0, left: 0, top: 0, right: 100, bottom: 40 },
        { index: 1, left: 0, top: 50, right: 100, bottom: 90 },
        { index: 2, left: 0, top: 100, right: 100, bottom: 140 },
    ]

    it('detects pointer intersections and centers', () => {
        expect(pointerIntersectsHitBox(hitBoxes[0], { clientX: 50, clientY: 20 })).toBe(true)
        expect(pointerIntersectsHitBox(hitBoxes[0], { clientX: 150, clientY: 20 })).toBe(false)
        expect(getHitBoxCenter(hitBoxes[1])).toEqual({ clientX: 50, clientY: 70 })
        expect(getIntersectingHitBox(hitBoxes, { clientX: 20, clientY: 110 })?.index).toBe(2)
    })

    it('resolves closest and direction-biased hit boxes by center', () => {
        expect(getClosestHitBoxByCenter(hitBoxes, { clientX: 45, clientY: 76 })?.index).toBe(1)
        expect(getDirectionBiasedHitBox(hitBoxes, { clientX: 50, clientY: 95 }, 'down')?.index).toBe(2)
        expect(getDirectionBiasedHitBox(hitBoxes, { clientX: 50, clientY: 95 }, 'up')?.index).toBe(1)
    })

    it('uses optional outer bounds without shifting item midpoints', () => {
        expect(getInsertionIndexFromPoint(hitBoxes, { clientX: 50, clientY: -20 })).toBeNull()
        expect(
            getInsertionIndexFromPoint(
                hitBoxes,
                { clientX: 50, clientY: -20 },
                {
                    bounds: { left: 0, top: -30, right: 100, bottom: 140 },
                },
            ),
        ).toBe(0)
        expect(
            getInsertionIndexFromPoint(
                hitBoxes,
                { clientX: 50, clientY: 138 },
                {
                    bounds: { left: 0, top: -30, right: 100, bottom: 180 },
                },
            ),
        ).toBe(3)
        expect(
            getInsertionIndexFromPoint(
                hitBoxes,
                { clientX: 50, clientY: -40 },
                {
                    bounds: { left: 0, top: -30, right: 100, bottom: 140 },
                },
            ),
        ).toBeNull()
    })
})

describe('findReorderHandle', () => {
    it('finds handles through composed paths', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const icon = document.createElement('span')

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        handle.append(icon)
        container.append(handle)
        document.body.append(container)

        const event = makeEvent('pointerdown', [icon, handle, container, document.body, document, window], container)

        expect(findReorderHandle(event)).toBe(handle)

        container.remove()
    })
})

describe('createAutoScroller', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('scrolls configured containers near an edge and reports scroll frames', () => {
        let frame: FrameRequestCallback | null = null
        const parent = document.createElement('div')
        const child = document.createElement('div')
        const onScroll = vi.fn()

        Object.defineProperties(parent, {
            clientHeight: { value: 100, configurable: true },
            scrollHeight: { value: 300, configurable: true },
            clientWidth: { value: 100, configurable: true },
            scrollWidth: { value: 100, configurable: true },
        })
        parent.getBoundingClientRect = () => rect(0, 0, 100, 100)
        parent.append(child)
        document.body.append(parent)

        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frame = callback

            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', () => {
            frame = null
        })

        const scroller = createAutoScroller({
            getScrollContainers: () => [parent],
            onScroll,
        })

        scroller.update({ clientX: 50, clientY: 98 }, child)
        expect(scroller.isScrolling()).toBe(true)

        frame?.(16)

        expect(parent.scrollTop).toBeGreaterThan(0)
        expect(onScroll).toHaveBeenCalledTimes(1)

        scroller.cleanup()
        parent.remove()
    })

    it('respects the configured scroll axis', () => {
        let frame: FrameRequestCallback | null = null
        const parent = document.createElement('div')
        const child = document.createElement('div')

        Object.defineProperties(parent, {
            clientHeight: { value: 100, configurable: true },
            scrollHeight: { value: 300, configurable: true },
            clientWidth: { value: 100, configurable: true },
            scrollWidth: { value: 300, configurable: true },
        })
        parent.getBoundingClientRect = () => rect(0, 0, 100, 100)
        parent.append(child)
        document.body.append(parent)

        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frame = callback

            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', () => {
            frame = null
        })

        const scroller = createAutoScroller({
            axis: 'y',
            getScrollContainers: () => [parent],
        })

        scroller.update({ clientX: 98, clientY: 98 }, child)
        frame?.(16)

        expect(parent.scrollTop).toBeGreaterThan(0)
        expect(parent.scrollLeft).toBe(0)

        scroller.cleanup()
        parent.remove()
    })

    it('cancels pending auto-scroll frames on cleanup', () => {
        let frame: FrameRequestCallback | null = null
        const cancelAnimationFrame = vi.fn(() => {
            frame = null
        })
        const parent = document.createElement('div')
        const child = document.createElement('div')

        Object.defineProperties(parent, {
            clientHeight: { value: 100, configurable: true },
            scrollHeight: { value: 300, configurable: true },
            clientWidth: { value: 100, configurable: true },
            scrollWidth: { value: 100, configurable: true },
        })
        parent.getBoundingClientRect = () => rect(0, 0, 100, 100)
        parent.append(child)
        document.body.append(parent)

        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frame = callback

            return 42
        })
        vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)

        const scroller = createAutoScroller({
            getScrollContainers: () => [parent],
        })

        scroller.update({ clientX: 50, clientY: 98 }, child)
        expect(scroller.isScrolling()).toBe(true)

        scroller.cleanup()

        expect(cancelAnimationFrame).toHaveBeenCalledWith(42)
        expect(scroller.isScrolling()).toBe(false)
        expect(frame).toBeNull()

        parent.remove()
    })
})

describe('createPointerReorder', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('starts from a nested composed-path handle when the listener is on an ancestor', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const icon = document.createElement('span')
        const onChange = vi.fn()
        const controller = createPointerReorder({
            getItemCount: () => 2,
            getHitBoxes: () => [
                { index: 0, left: 0, top: 0, right: 100, bottom: 50 },
                { index: 1, left: 0, top: 50, right: 100, bottom: 100 },
            ],
            onChange,
            onCommit: vi.fn(),
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        handle.append(icon)
        container.append(handle)
        document.body.append(container)

        controller.pointerDown(
            0,
            makeEvent('pointerdown', [icon, handle, container, document.body, document, window], container),
        )

        expect(controller.isDragging()).toBe(true)
        expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 0, insertionIndex: 0, targetIndex: 0 })

        controller.cleanup()
        container.remove()
    })

    it('does not treat normal pointer capture release as a canceled reorder', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const onCommit = vi.fn()
        const controller = createPointerReorder({
            getItemCount: () => 2,
            getHitBoxes: () => [
                { index: 0, left: 0, top: 0, right: 100, bottom: 50 },
                { index: 1, left: 0, top: 50, right: 100, bottom: 100 },
            ],
            onCommit,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        handle.setPointerCapture = vi.fn()
        handle.hasPointerCapture = vi.fn(() => false)
        handle.releasePointerCapture = vi.fn()
        container.append(handle)
        document.body.append(container)

        controller.pointerDown(
            0,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 90 }))
        handle.dispatchEvent(
            makeEvent('lostpointercapture', [handle, container, document.body, document, window], handle),
        )
        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: 50, clientY: 90 }))

        expect(onCommit).toHaveBeenCalledWith(0, 1, 'pointer')

        controller.cleanup()
        container.remove()
    })

    it('commits the visible preview target when the release coordinate is noisy', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const onCommit = vi.fn()
        const controller = createPointerReorder({
            getItemCount: () => 2,
            getHitBoxes: () => [
                { index: 0, left: 0, top: 0, right: 100, bottom: 50 },
                { index: 1, left: 0, top: 50, right: 100, bottom: 100 },
            ],
            getBounds: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
            onCommit,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)

        controller.pointerDown(
            1,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container, {
                clientX: 50,
                clientY: 75,
            }),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))
        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: 50, clientY: 140 }))

        expect(onCommit).toHaveBeenCalledWith(1, 0, 'pointer')

        controller.cleanup()
        container.remove()
    })

    it('keeps the last valid preview while the pointer temporarily leaves horizontal bounds', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const onCommit = vi.fn()
        const controller = createPointerReorder({
            getItemCount: () => 2,
            getHitBoxes: () => [
                { index: 0, left: 0, top: 0, right: 100, bottom: 50 },
                { index: 1, left: 0, top: 50, right: 100, bottom: 100 },
            ],
            getBounds: () => ({ left: 0, top: Number.NEGATIVE_INFINITY, right: 100, bottom: Number.POSITIVE_INFINITY }),
            onCommit,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)

        controller.pointerDown(
            1,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container, {
                clientX: 50,
                clientY: 75,
            }),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))

        expect(controller.getState()).toEqual({ draggedIndex: 1, insertionIndex: 0, targetIndex: 0 })

        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: -40, clientY: 10 }))

        expect(controller.getState()).toEqual({ draggedIndex: 1, insertionIndex: 0, targetIndex: 0 })

        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: -40, clientY: 10 }))

        expect(onCommit).not.toHaveBeenCalled()

        controller.cleanup()
        container.remove()
    })

    it('refreshes hit boxes while pointer auto-scroll is active', () => {
        let frame: FrameRequestCallback | null = null
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const getHitBoxes = vi.fn(() => [
            { index: 0, left: 0, top: 0 - container.scrollTop, right: 100, bottom: 50 - container.scrollTop },
            { index: 1, left: 0, top: 50 - container.scrollTop, right: 100, bottom: 100 - container.scrollTop },
        ])
        const controller = createPointerReorder({
            getItemCount: () => 2,
            getHitBoxes,
            autoScroll: {
                getScrollContainers: () => [container],
            },
            onCommit: vi.fn(),
        })

        Object.defineProperties(container, {
            clientHeight: { value: 100, configurable: true },
            scrollHeight: { value: 300, configurable: true },
            clientWidth: { value: 100, configurable: true },
            scrollWidth: { value: 100, configurable: true },
        })
        container.getBoundingClientRect = () => rect(0, 0, 100, 100)
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)

        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frame = callback

            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', () => {
            frame = null
        })

        controller.pointerDown(
            0,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 98 }))
        expect(getHitBoxes).toHaveBeenCalledTimes(1)

        frame?.(16)

        expect(container.scrollTop).toBeGreaterThan(0)
        expect(getHitBoxes).toHaveBeenCalledTimes(2)

        controller.cleanup()
        container.remove()
    })
})
