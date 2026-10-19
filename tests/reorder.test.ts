import {
    createReorderableList,
    REORDERABLE_LIST_HANDLE_ATTRIBUTE,
    type ReorderBounds,
    type ReorderPointer,
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

describe('createReorderableList', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('returns fresh dense preview indexes for the current items, including sparse arrays', () => {
        let items: string[] = ['alpha', 'beta', 'gamma']
        const controller = createReorderableList({ getItems: () => items })
        const first = controller.getPreviewOrder()
        first.reverse()
        expect(controller.getPreviewOrder()).toEqual([0, 1, 2])
        items = []
        items.length = 4
        items[2] = 'sparse'
        expect(controller.getPreviewOrder()).toEqual([0, 1, 2, 3])
        expect(controller.getPreviewItems()).toEqual([
            { item: undefined, index: 0, visualIndex: 0 },
            { item: undefined, index: 1, visualIndex: 1 },
            { item: 'sparse', index: 2, visualIndex: 2 },
            { item: undefined, index: 3, visualIndex: 3 },
        ])
        items = []
        expect(controller.getPreviewOrder()).toEqual([])
        controller.cleanup()
    })

    it('preserves getter reads and filters preview indexes against the first item snapshot', () => {
        const getItems = vi.fn().mockReturnValueOnce(['first']).mockReturnValue(['other', 'extra'])
        const controller = createReorderableList({ getItems })
        expect(controller.getPreviewItems()).toEqual([{ item: 'first', index: 0, visualIndex: 0 }])
        expect(getItems).toHaveBeenCalledTimes(2)
        controller.cleanup()
    })

    it('previews pointer order and commits the previewed move once', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta', 'gamma']
        const onChange = vi.fn()
        const onBeforeReorder = vi.fn()
        const onReorder = vi.fn()
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            getBounds: () => ({ left: 0, top: Number.NEGATIVE_INFINITY, right: 100, bottom: Number.POSITIVE_INFINITY }),
            onChange,
            onBeforeReorder,
            onReorder,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)
        controller.setListElement(container)

        for (const index of [0, 1, 2]) {
            const row = document.createElement('div')
            row.getBoundingClientRect = () => rect(0, index * 50, 100, index * 50 + 40)
            container.append(row)
            controller.setItemElement(index, row)
        }

        controller.pointerDown(
            2,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container, {
                clientX: 50,
                clientY: 120,
            }),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))

        expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 2, insertionIndex: 0, targetIndex: 0 })
        expect(controller.getPreviewOrder()).toEqual([2, 0, 1])
        expect(controller.getPreviewItems().map((entry) => entry.item)).toEqual(['gamma', 'alpha', 'beta'])

        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))

        expect(items).toEqual(['gamma', 'alpha', 'beta'])
        expect(onBeforeReorder).toHaveBeenCalledWith(
            { item: 'gamma', fromIndex: 2, toIndex: 0, source: 'pointer' },
            { alreadyPreviewed: true },
        )
        expect(onReorder).toHaveBeenCalledWith(
            { item: 'gamma', fromIndex: 2, toIndex: 0, source: 'pointer' },
            { alreadyPreviewed: true },
        )
        expect(controller.getPreviewOrder()).toEqual([0, 1, 2])

        controller.cleanup()
        container.remove()
    })

    it('keeps the visible preview but cancels release after leaving bounds', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta', 'gamma']
        const onReorder = vi.fn()
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            getBounds: () => ({ left: 0, top: Number.NEGATIVE_INFINITY, right: 100, bottom: Number.POSITIVE_INFINITY }),
            onReorder,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)

        for (const index of [0, 1, 2]) {
            const row = document.createElement('div')
            row.getBoundingClientRect = () => rect(0, index * 50, 100, index * 50 + 40)
            container.append(row)
            controller.setItemElement(index, row)
        }

        controller.pointerDown(
            2,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container, {
                clientX: 50,
                clientY: 120,
            }),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))
        expect(controller.getPreviewOrder()).toEqual([2, 0, 1])

        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: -40, clientY: 10 }))
        expect(controller.getPreviewOrder()).toEqual([2, 0, 1])

        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: -40, clientY: 10 }))

        expect(items).toEqual(['alpha', 'beta', 'gamma'])
        expect(onReorder).not.toHaveBeenCalled()
        expect(controller.getPreviewOrder()).toEqual([0, 1, 2])

        controller.cleanup()
        container.remove()
    })

    it('commits keyboard moves without preview context', () => {
        let items = ['alpha', 'beta', 'gamma']
        const onBeforeReorder = vi.fn()
        const onReorder = vi.fn()
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            onBeforeReorder,
            onReorder,
        })

        expect(controller.moveItem(1, 'up')).toEqual({ item: 'beta', fromIndex: 1, toIndex: 0, source: 'keyboard' })
        expect(items).toEqual(['beta', 'alpha', 'gamma'])
        expect(onBeforeReorder).toHaveBeenCalledWith(
            { item: 'beta', fromIndex: 1, toIndex: 0, source: 'keyboard' },
            { alreadyPreviewed: false },
        )
        expect(onReorder).toHaveBeenCalledWith(
            { item: 'beta', fromIndex: 1, toIndex: 0, source: 'keyboard' },
            { alreadyPreviewed: false },
        )

        controller.cleanup()
    })

    it('ignores disabled, out-of-range, and missing-handle reorders', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta']
        const onReorder = vi.fn()
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            canReorder: () => false,
            onReorder,
        })

        container.append(handle)
        document.body.append(container)
        controller.setItemElement(0, handle)

        expect(controller.moveItem(1, 'up')).toBeNull()
        controller.pointerDown(
            0,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container),
        )

        expect(items).toEqual(['alpha', 'beta'])
        expect(onReorder).not.toHaveBeenCalled()
        expect(controller.getPreviewOrder()).toEqual([0, 1])

        controller.cleanup()
        container.remove()
    })

    it('starts from a nested composed-path handle when the listener is on an ancestor', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const icon = document.createElement('span')
        const onChange = vi.fn()
        const controller = createReorderableList({
            getItems: () => ['alpha', 'beta'],
            onChange,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        handle.append(icon)
        container.append(handle)
        document.body.append(container)

        controller.pointerDown(
            0,
            makeEvent('pointerdown', [icon, handle, container, document.body, document, window], container),
        )

        expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 0, insertionIndex: 0, targetIndex: 0 })

        controller.cleanup()
        container.remove()
    })

    it('does not treat normal pointer capture release as a canceled reorder', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta']
        const onReorder = vi.fn()
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            onReorder,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        handle.setPointerCapture = vi.fn()
        handle.hasPointerCapture = vi.fn(() => false)
        handle.releasePointerCapture = vi.fn()
        container.append(handle)
        document.body.append(container)
        for (const index of [0, 1]) {
            const row = document.createElement('div')
            row.getBoundingClientRect = () => rect(0, index * 50, 100, index * 50 + 50)
            container.append(row)
            controller.setItemElement(index, row)
        }

        controller.pointerDown(
            0,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 90 }))
        handle.dispatchEvent(
            makeEvent('lostpointercapture', [handle, container, document.body, document, window], handle),
        )
        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: 50, clientY: 90 }))

        expect(items).toEqual(['beta', 'alpha'])
        expect(onReorder).toHaveBeenCalledWith(
            { item: 'alpha', fromIndex: 0, toIndex: 1, source: 'pointer' },
            { alreadyPreviewed: true },
        )

        controller.cleanup()
        container.remove()
    })

    it('commits the visible preview target when the release coordinate is noisy', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta']
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            getBounds: () => ({ left: 0, top: 0, right: 100, bottom: 100 }),
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)
        for (const index of [0, 1]) {
            const row = document.createElement('div')
            row.getBoundingClientRect = () => rect(0, index * 50, 100, index * 50 + 50)
            container.append(row)
            controller.setItemElement(index, row)
        }

        controller.pointerDown(
            1,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container, {
                clientX: 50,
                clientY: 75,
            }),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))
        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: 50, clientY: 140 }))

        expect(items).toEqual(['beta', 'alpha'])

        controller.cleanup()
        container.remove()
    })

    it('keeps the last valid preview while the pointer temporarily leaves horizontal bounds', () => {
        const container = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta']
        const onReorder = vi.fn()
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            getBounds: () => ({ left: 0, top: Number.NEGATIVE_INFINITY, right: 100, bottom: Number.POSITIVE_INFINITY }),
            onReorder,
        })

        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)
        for (const index of [0, 1]) {
            const row = document.createElement('div')
            row.getBoundingClientRect = () => rect(0, index * 50, 100, index * 50 + 50)
            container.append(row)
            controller.setItemElement(index, row)
        }

        controller.pointerDown(
            1,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container, {
                clientX: 50,
                clientY: 75,
            }),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))

        expect(controller.getPreviewOrder()).toEqual([1, 0])

        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: -40, clientY: 10 }))

        expect(controller.getPreviewOrder()).toEqual([1, 0])

        window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1, clientX: -40, clientY: 10 }))

        expect(items).toEqual(['alpha', 'beta'])
        expect(onReorder).not.toHaveBeenCalled()

        controller.cleanup()
        container.remove()
    })

    it.each(['custom containers', 'slotted handle'])('auto-scrolls while pointer dragging with %s', (scenario) => {
        let frame: FrameRequestCallback | null = null
        const container = document.createElement('div')
        const host = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            autoScroll: scenario === 'slotted handle' ? { axis: 'y' } : { getScrollContainers: () => [container] },
        })

        container.style.overflowY = 'auto'
        Object.defineProperties(container, {
            clientHeight: { value: 100, configurable: true },
            scrollHeight: { value: 300, configurable: true },
            clientWidth: { value: 100, configurable: true },
            scrollWidth: { value: 100, configurable: true },
        })
        container.getBoundingClientRect = () => rect(0, 0, 100, 100)
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        document.body.append(host)
        if (scenario === 'slotted handle') {
            const slot = document.createElement('slot')
            host.attachShadow({ mode: 'open' }).append(container)
            container.append(slot)
            host.append(handle)
            // Happy DOM does not assign slots; the browser suite covers native assignment.
            Object.defineProperty(handle, 'assignedSlot', { value: slot })
        } else {
            host.append(container)
            container.append(handle)
        }
        for (const index of [0, 1, 2, 3, 4, 5]) {
            const row = document.createElement('div')
            row.getBoundingClientRect = () =>
                rect(0, index * 50 - container.scrollTop, 100, index * 50 + 50 - container.scrollTop)
            container.append(row)
            controller.setItemElement(index, row)
        }

        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frame = callback

            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', () => {
            frame = null
        })

        try {
            controller.pointerDown(
                0,
                makeEvent('pointerdown', [handle, container, document.body, document, window], container),
            )
            window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 98 }))

            for (let timestamp = 16; timestamp <= 160; timestamp += 16) {
                frame?.(timestamp)
            }

            expect(container.scrollTop).toBeCloseTo(110.4)
            window.dispatchEvent(makeEvent('pointerup', [window], window, { clientX: 50, clientY: 98 }))
            expect(items).toEqual(['beta', 'gamma', 'delta', 'alpha', 'epsilon', 'zeta'])
        } finally {
            controller.cleanup()
            host.remove()
        }
    })

    it.each(['vertical', 'horizontal', 'rtl', 'window', 'slotted items'])(
        'updates %s targets after manual scrolling without remeasuring previews',
        (direction) => {
            const outer = document.createElement('div')
            const container = document.createElement('div')
            const handle = document.createElement('button')
            const horizontal = direction === 'horizontal' || direction === 'rtl'
            const rtl = direction === 'rtl'
            const scrollProperty = horizontal ? 'scrollLeft' : 'scrollTop'
            const sign = rtl ? -1 : 1
            let items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']
            const getCollisionPoint = vi.fn((pointer: ReorderPointer, _item: ReorderBounds) => pointer.position)
            const controller = createReorderableList({
                getItems: () => items,
                setItems: (nextItems) => {
                    items = nextItems
                },
                getCollisionPoint,
            })
            container.style.direction = rtl ? 'rtl' : 'ltr'
            // Programmatic scrolling of overflow:hidden ancestors also displaces the items.
            container.style.overflow = outer.style.overflow = 'hidden'
            container[scrollProperty] = sign * 20
            outer[scrollProperty] = sign * 10
            container.getBoundingClientRect = () => rect(0, 0, 100, 100)
            handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
            container.append(handle)
            const slot = document.createElement('slot')
            if (direction === 'slotted items') {
                outer.attachShadow({ mode: 'open' }).append(container)
                container.append(slot)
            } else {
                outer.append(container)
            }
            document.body.append(outer)
            controller.setListElement(container)
            const root = document.documentElement
            const rootScrollTop = root.scrollTop
            if (direction === 'window') {
                vi.stubGlobal('scrollY', 10)
                root.scrollTop = 10
            }

            const measurements = items.map((_, index) => {
                const row = document.createElement('div')
                const start = rtl ? 50 - index * 50 : index * 50
                const bounds = horizontal ? rect(start, 0, start + 50, 100) : rect(0, start, 100, start + 50)
                const measure = vi
                    .fn()
                    .mockReturnValueOnce(bounds)
                    .mockReturnValue(rect(500, 500, 600, 600))
                row.getBoundingClientRect = measure
                if (direction === 'slotted items') {
                    outer.append(row)
                    Object.defineProperty(row, 'assignedSlot', { value: slot })
                } else {
                    container.append(row)
                }
                controller.setItemElement(index, row)
                return measure
            })
            const point = { clientX: horizontal ? (rtl ? 2 : 98) : 50, clientY: horizontal ? 50 : 98 }

            try {
                controller.pointerDown(0, makeEvent('pointerdown', [handle, container], container))
                window.dispatchEvent(makeEvent('pointermove', [window], window, point))
                expect(controller.getPreviewOrder()).toEqual([1, 0, 2, 3, 4, 5])

                if (direction === 'window') {
                    vi.stubGlobal('scrollY', 120)
                    // The root exposes the same scroll as window; count it only once.
                    root.scrollTop = 120
                } else {
                    container[scrollProperty] += sign * 70
                    outer[scrollProperty] += sign * 40
                }
                window.dispatchEvent(makeEvent('pointermove', [window], window, point))
                expect(controller.getPreviewOrder()).toEqual([1, 2, 3, 0, 4, 5])
                // Repeated moves must not accumulate the same displacement or read preview transforms.
                window.dispatchEvent(makeEvent('pointermove', [window], window, point))
                expect(controller.getPreviewOrder()).toEqual([1, 2, 3, 0, 4, 5])
                expect(getCollisionPoint).toHaveBeenCalledTimes(3)
                for (const [, item] of getCollisionPoint.mock.calls) {
                    expect(item).toEqual(
                        expect.objectContaining({
                            left: rtl ? 50 : 0,
                            top: 0,
                            right: horizontal ? (rtl ? 100 : 50) : 100,
                            bottom: horizontal ? 100 : 50,
                        }),
                    )
                }
                measurements.forEach((measure) => expect(measure).toHaveBeenCalledTimes(1))

                window.dispatchEvent(makeEvent('pointerup', [window], window, point))
                expect(items).toEqual(['beta', 'gamma', 'delta', 'alpha', 'epsilon', 'zeta'])
            } finally {
                controller.cleanup()
                outer.remove()
                root.scrollTop = rootScrollTop
            }
        },
    )

    it('auto-scrolls right-to-left containers both ways', () => {
        let frame: FrameRequestCallback | null = null
        let scrollLeft = 0
        const container = document.createElement('div')
        const handle = document.createElement('button')
        const controller = createReorderableList({
            getItems: () => ['alpha', 'beta'],
            autoScroll: { axis: 'x', getScrollContainers: () => [container] },
        })

        // Right-to-left content starts scrolled to the right edge at 0 and scrolls left into negative positions.
        container.style.direction = 'rtl'
        Object.defineProperties(container, {
            clientWidth: { value: 100, configurable: true },
            scrollWidth: { value: 300, configurable: true },
            clientHeight: { value: 100, configurable: true },
            scrollHeight: { value: 100, configurable: true },
            scrollLeft: {
                configurable: true,
                get: () => scrollLeft,
                set: (value: number) => (scrollLeft = Math.min(0, Math.max(-200, value))),
            },
        })
        container.getBoundingClientRect = () => rect(0, 0, 100, 100)
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        container.append(handle)
        document.body.append(container)
        for (const index of [0, 1]) {
            const cell = document.createElement('div')
            cell.getBoundingClientRect = () => rect(50 - index * 50, 0, 100 - index * 50, 100)
            container.append(cell)
            controller.setItemElement(index, cell)
        }
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frame = callback

            return 1
        })
        vi.stubGlobal('cancelAnimationFrame', () => {
            frame = null
        })

        try {
            controller.pointerDown(
                0,
                makeEvent('pointerdown', [handle, container, document.body, document, window], container),
            )
            window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 2, clientY: 50 }))
            frame?.(16)
            expect(scrollLeft).toBeLessThan(0)

            scrollLeft = -200
            window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 98, clientY: 50 }))
            frame?.(32)
            expect(scrollLeft).toBeGreaterThan(-200)
        } finally {
            controller.cleanup()
            container.remove()
        }
    })

    it.each([
        { name: 'first grid column', x: 20, y: 20, expected: 0 },
        { name: 'second grid column', x: 45, y: 20, expected: 1 },
        { name: 'third grid column', x: 95, y: 20, expected: 2 },
        { name: 'after the first row', x: 140, y: 20, expected: 3 },
        { name: 'gap between rows', x: 70, y: 45, expected: 3 },
        { name: 'above the grid', x: 70, y: -10, expected: 0 },
        { name: 'below the grid', x: 70, y: 100, expected: 6 },
    ])('resolves $name without changing grid insertion semantics', ({ x, y, expected }) => {
        const handle = document.createElement('button')
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        const onChange = vi.fn()
        const controller = createReorderableList({
            getItems: () => [0, 1, 2, 3, 4, 5],
            getBounds: () => ({ left: -10, top: -10, right: 150, bottom: 100 }),
            onChange,
        })
        for (let index = 5; index >= 0; index--) {
            const element = document.createElement('div')
            const left = (index % 3) * 50
            const top = Math.floor(index / 3) * 50
            element.getBoundingClientRect = () => rect(left, top, left + 40, top + 40)
            controller.setItemElement(index, element)
        }
        try {
            controller.pointerDown(5, makeEvent('pointerdown', [handle], handle))
            window.dispatchEvent(makeEvent('pointermove', [window], window, { clientX: x, clientY: y }))
            expect(onChange).toHaveBeenLastCalledWith({
                draggedIndex: 5,
                insertionIndex: expected,
                targetIndex: Math.min(expected, 5),
            })
        } finally {
            controller.cleanup()
        }
    })

    it.each([
        {
            name: 'in index order',
            rects: [rect(100, 0, 140, 40), rect(50, 0, 90, 40), rect(0, 0, 40, 40)],
            moves: [
                [130, 0, 0],
                [110, 1, 0],
                [60, 2, 1],
                [10, 3, 2],
            ],
        },
        {
            name: 'out of index order',
            rects: [rect(50, 0, 90, 40), rect(100, 0, 140, 40), rect(0, 0, 40, 40)],
            moves: [
                [130, 1, 0],
                [110, 0, 0],
                [60, 2, 1],
                [10, 3, 2],
            ],
        },
    ])('reads a right-to-left row in visual order from the right, $name', ({ rects, moves }) => {
        const handle = document.createElement('button')
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        const list = document.createElement('div')
        list.style.direction = 'rtl'
        list.getBoundingClientRect = () => rect(0, 0, 140, 40)
        document.body.append(list)
        const onChange = vi.fn()
        const controller = createReorderableList({ getItems: () => [0, 1, 2], onChange })
        controller.setListElement(list)
        rects.forEach((value, index) => {
            const element = document.createElement('div')
            element.getBoundingClientRect = () => value
            controller.setItemElement(index, element)
        })
        try {
            controller.pointerDown(0, makeEvent('pointerdown', [handle], handle, { clientX: 130, clientY: 20 }))
            for (const [clientX, insertionIndex, targetIndex] of moves) {
                window.dispatchEvent(makeEvent('pointermove', [window], window, { clientX, clientY: 20 }))
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 0, insertionIndex, targetIndex })
            }
        } finally {
            controller.cleanup()
            list.remove()
        }
    })

    it('uses visual horizontal order and ignores invalid rectangles', () => {
        const handle = document.createElement('button')
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        const onChange = vi.fn()
        const controller = createReorderableList({ getItems: () => [0, 1, 2, 3, 4], onChange })
        const rectangles = [
            rect(100, 0, 140, 40),
            rect(0, 0, 40, 40),
            rect(50, 0, 90, 40),
            rect(NaN, 0, 1, 1),
            rect(2, 0, 1, 1),
        ]
        rectangles.forEach((value, index) => {
            const element = document.createElement('div')
            element.getBoundingClientRect = () => value
            controller.setItemElement(index, element)
        })
        try {
            controller.pointerDown(4, makeEvent('pointerdown', [handle], handle))
            for (const [clientX, expected] of [
                [10, 1],
                [60, 2],
                [110, 0],
                [140, 1],
            ]) {
                window.dispatchEvent(makeEvent('pointermove', [window], window, { clientX, clientY: 20 }))
                expect(onChange).toHaveBeenLastCalledWith({
                    draggedIndex: 4,
                    insertionIndex: expected,
                    targetIndex: expected,
                })
            }
        } finally {
            controller.cleanup()
        }
    })

    it('does not repeatedly sort item rectangles during a drag', () => {
        const handle = document.createElement('button')
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        const onChange = vi.fn()
        const controller = createReorderableList({ getItems: () => [0, 1, 2], onChange })
        for (let index = 0; index < 3; index++) {
            const element = document.createElement('div')
            element.getBoundingClientRect = () => rect(0, index * 50, 100, index * 50 + 40)
            controller.setItemElement(index, element)
        }
        try {
            const sort = vi.spyOn(Array.prototype, 'sort')
            controller.pointerDown(2, makeEvent('pointerdown', [handle], handle))
            for (let i = 0; i < 20; i++) {
                window.dispatchEvent(makeEvent('pointermove', [window], window, { clientX: 50, clientY: 10 }))
            }
            const sortCount = sort.mock.calls.length
            sort.mockRestore()
            expect(sortCount).toBeLessThanOrEqual(1)
            expect(onChange).toHaveBeenCalledTimes(21)
            expect(controller.getPreviewOrder()).toEqual([2, 0, 1])
        } finally {
            controller.cleanup()
        }
    })

    it.each(['disabled', 'non-handle', 'secondary-button', 'non-primary', 'single-item', 'cleaned'])(
        'does not measure rows for a %s pointer start',
        (reason) => {
            const handle = document.createElement('button')
            if (reason !== 'non-handle') handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
            const onChange = vi.fn()
            const controller = createReorderableList({
                getItems: () => (reason === 'single-item' ? [0] : [0, 1]),
                canReorder: () => reason !== 'disabled',
                onChange,
            })
            const measure = vi.fn(() => rect(0, 0, 100, 50))
            const element = document.createElement('div')
            element.getBoundingClientRect = measure
            controller.setItemElement(0, element)
            if (reason === 'cleaned') controller.cleanup()
            try {
                const event = makeEvent('pointerdown', [handle], handle, {
                    button: reason === 'secondary-button' ? 2 : 0,
                    isPrimary: reason !== 'non-primary',
                })
                controller.pointerDown(0, event)
                expect(measure).not.toHaveBeenCalled()
                expect(onChange).not.toHaveBeenCalled()
                expect(event.defaultPrevented).toBe(false)
            } finally {
                controller.cleanup()
            }
        },
    )

    it('keeps the accepted drag snapshot when a second pointer start is rejected', () => {
        const handle = document.createElement('button')
        handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
        let offset = 0
        const measure = vi.fn((index: number) => rect(0, index * 50 + offset, 100, index * 50 + 40 + offset))
        const onChange = vi.fn()
        const onReorder = vi.fn()
        const controller = createReorderableList({ getItems: () => [0, 1, 2], onChange, onReorder })
        for (let index = 0; index < 3; index++) {
            const element = document.createElement('div')
            element.getBoundingClientRect = () => measure(index)
            controller.setItemElement(index, element)
        }
        try {
            controller.pointerDown(2, makeEvent('pointerdown', [handle], handle, { pointerId: 1 }))
            expect(measure).toHaveBeenCalledTimes(3)
            offset = 100
            controller.pointerDown(1, makeEvent('pointerdown', [handle], handle, { pointerId: 2 }))
            expect(measure).toHaveBeenCalledTimes(3)
            window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 10 }))
            expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 2, insertionIndex: 0, targetIndex: 0 })
            window.dispatchEvent(makeEvent('pointerup', [window], window, { pointerId: 1 }))
            expect(onReorder).toHaveBeenCalledWith(
                { item: 2, fromIndex: 2, toIndex: 0, source: 'pointer' },
                { alreadyPreviewed: true },
            )
            // A later accepted gesture takes a fresh snapshot.
            controller.pointerDown(1, makeEvent('pointerdown', [handle], handle, { pointerId: 3 }))
            expect(measure).toHaveBeenCalledTimes(6)
        } finally {
            controller.cleanup()
        }
    })

    describe('activation distance', () => {
        function setup(options: Partial<Parameters<typeof createReorderableList<number>>[0]> = {}) {
            const handle = document.createElement('button')
            handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
            handle.setPointerCapture = vi.fn()
            document.body.append(handle)
            let items = [0, 1, 2]
            const onChange = vi.fn()
            const onReorder = vi.fn()
            const controller = createReorderableList({
                getItems: () => items,
                setItems: (nextItems) => {
                    items = nextItems
                },
                getBounds: () => ({ left: 0, top: -Infinity, right: 100, bottom: Infinity }),
                activationDistance: 4,
                onChange,
                onReorder,
                ...options,
            })
            for (let index = 0; index < 3; index++) {
                const element = document.createElement('div')
                element.getBoundingClientRect = () => rect(0, index * 50, 100, index * 50 + 40)
                controller.setItemElement(index, element)
            }
            const press = (clientY = 20, index = 0) => {
                const event = makeEvent('pointerdown', [handle, document.body, document, window], handle, {
                    clientX: 50,
                    clientY,
                })
                controller.pointerDown(index, event)

                return event
            }
            const move = (clientY: number) =>
                window.dispatchEvent(makeEvent('pointermove', [window], window, { clientX: 50, clientY }))
            const release = (clientY: number) =>
                window.dispatchEvent(makeEvent('pointerup', [window], window, { clientX: 50, clientY }))
            const click = () => {
                const event = new MouseEvent('click', { bubbles: true, cancelable: true })
                handle.dispatchEvent(event)

                return event.defaultPrevented
            }

            return { handle, controller, onChange, onReorder, press, move, release, click, items: () => items }
        }

        it('leaves a press alone until the pointer travels the distance', () => {
            const { handle, controller, onChange, press, move } = setup()
            try {
                expect(press().defaultPrevented).toBe(false)
                move(22)
                expect(onChange).not.toHaveBeenCalled()
                expect(handle.setPointerCapture).not.toHaveBeenCalled()
                expect(controller.getPointer()).toBeNull()

                move(80)
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 0, insertionIndex: 2, targetIndex: 1 })
                expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
                expect(controller.getPointer()).toEqual({
                    origin: { clientX: 50, clientY: 20 },
                    position: { clientX: 50, clientY: 80 },
                })
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('discards a press released before the distance', () => {
            const { handle, controller, onChange, onReorder, press, move, release, click } = setup()
            try {
                press()
                release(21)
                move(80)
                expect(onChange).not.toHaveBeenCalled()
                expect(onReorder).not.toHaveBeenCalled()
                expect(click()).toBe(false)
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('cancels pending and active gestures without committing, and stays usable', () => {
            const { handle, controller, onChange, onReorder, press, move, release } = setup()
            try {
                press()
                controller.cancel()
                move(80)
                expect(onChange).not.toHaveBeenCalled()

                press()
                move(80)
                controller.cancel()
                expect(onChange).toHaveBeenLastCalledWith({
                    draggedIndex: null,
                    insertionIndex: null,
                    targetIndex: null,
                })
                expect(controller.getPointer()).toBeNull()
                release(80)
                expect(onReorder).not.toHaveBeenCalled()

                press()
                move(80)
                release(80)
                expect(onReorder).toHaveBeenCalledWith(
                    { item: 0, fromIndex: 0, toIndex: 1, source: 'pointer' },
                    { alreadyPreviewed: true },
                )
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('ends a gesture silently on cleanup', () => {
            const { handle, controller, onChange, press, move } = setup()
            press()
            move(80)
            onChange.mockClear()
            controller.cleanup()
            move(120)
            expect(onChange).not.toHaveBeenCalled()
            handle.remove()
        })

        it('ignores invalid source indexes before preventing native interaction', () => {
            for (const activationDistance of [0, 4]) {
                const { handle, controller, onChange, press, move, release } = setup({ activationDistance })
                try {
                    for (const index of [-1, 3, 0.5, NaN, Infinity]) {
                        expect(press(20, index).defaultPrevented).toBe(false)
                        move(80)
                        release(80)
                    }
                    expect(onChange).not.toHaveBeenCalled()
                    expect(handle.setPointerCapture).not.toHaveBeenCalled()
                } finally {
                    controller.cleanup()
                    handle.remove()
                }
            }
        })

        it('rechecks the pending source index when items disappear before activation', () => {
            let items = [0, 1, 2]
            const { handle, controller, onChange, press, move } = setup({ getItems: () => items })
            try {
                press(120, 2)
                items = [0, 1]
                move(80)
                expect(onChange).not.toHaveBeenCalled()
                expect(controller.getPointer()).toBeNull()
                expect(handle.setPointerCapture).not.toHaveBeenCalled()

                press()
                move(80)
                expect(controller.getPointer()).not.toBeNull()
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('ends pending and active gestures when the window loses focus', () => {
            const { handle, controller, onChange, onReorder, press, move, release } = setup()
            try {
                press()
                window.dispatchEvent(new Event('blur'))
                move(80)
                expect(onChange).not.toHaveBeenCalled()

                press()
                move(80)
                window.dispatchEvent(new Event('blur'))
                expect(controller.getPointer()).toBeNull()
                expect(onChange).toHaveBeenLastCalledWith({
                    draggedIndex: null,
                    insertionIndex: null,
                    targetIndex: null,
                })
                release(80)
                expect(onReorder).not.toHaveBeenCalled()

                press()
                move(80)
                release(80)
                expect(onReorder).toHaveBeenCalledOnce()
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('does not suppress an unrelated click after the browser cancels a pointer', () => {
            const { handle, controller, press, move, click } = setup({ suppressClickAfterDrag: true })
            try {
                press()
                move(80)
                window.dispatchEvent(makeEvent('pointercancel', [window], window))
                expect(controller.getPointer()).toBeNull()
                expect(click()).toBe(false)
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('suppresses only the click that follows a drag', () => {
            const { handle, controller, press, move, release, click } = setup({ suppressClickAfterDrag: true })
            try {
                press()
                release(20)
                expect(click()).toBe(false)

                press()
                move(80)
                release(80)
                expect(click()).toBe(true)
                expect(click()).toBe(false)

                press()
                move(80)
                controller.cancel()
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
                expect(click()).toBe(false)
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('keeps activating on press by default', () => {
            const { handle, controller, onChange, press } = setup({ activationDistance: undefined })
            try {
                expect(press().defaultPrevented).toBe(true)
                expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 0, insertionIndex: 0, targetIndex: 0 })
                expect(controller.getPointer()).toEqual({
                    origin: { clientX: 50, clientY: 20 },
                    position: { clientX: 50, clientY: 20 },
                })
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })
    })

    describe('collision point', () => {
        // A row with a wide middle item between two narrow ones: 0 [0, 100], 1 [100, 400], 2 [400, 500].
        const boxes = [rect(0, 0, 100, 40), rect(100, 0, 400, 40), rect(400, 0, 500, 40)]
        const leadingEdge = ({ origin, position }: ReorderPointer, item: ReorderBounds) => {
            const offset = position.clientX - origin.clientX

            return { clientX: (offset > 0 ? item.right : item.left) + offset, clientY: position.clientY }
        }

        function setup(options: Partial<Parameters<typeof createReorderableList<number>>[0]> = {}) {
            const handle = document.createElement('button')
            handle.setAttribute(REORDERABLE_LIST_HANDLE_ATTRIBUTE, 'true')
            handle.setPointerCapture = vi.fn()
            document.body.append(handle)
            let items = [0, 1, 2]
            const onChange = vi.fn()
            const onReorder = vi.fn()
            const controller = createReorderableList({
                getItems: () => items,
                setItems: (nextItems) => {
                    items = nextItems
                },
                getBounds: () => rect(0, 0, 500, 40),
                activationDistance: 4,
                onChange,
                onReorder,
                ...options,
            })
            boxes.forEach((box, index) => {
                const element = document.createElement('div')
                element.getBoundingClientRect = () => box
                controller.setItemElement(index, element)
            })
            // Grab the wide item near its start.
            const press = () =>
                controller.pointerDown(
                    1,
                    makeEvent('pointerdown', [handle, document.body, document, window], handle, {
                        clientX: 120,
                        clientY: 20,
                    }),
                )
            const move = (clientX: number, clientY = 20) =>
                window.dispatchEvent(makeEvent('pointermove', [window], window, { clientX, clientY }))
            const release = (clientX: number, clientY = 20) =>
                window.dispatchEvent(makeEvent('pointerup', [window], window, { clientX, clientY }))

            return { handle, controller, onChange, onReorder, press, move, release, items: () => items }
        }

        it('picks the slot from the pointer by default and when the point is null', () => {
            for (const getCollisionPoint of [undefined, () => null]) {
                const { handle, controller, onReorder, press, move, release } = setup({ getCollisionPoint })
                try {
                    // The wide item now covers its narrow neighbor, but the pointer is short of that neighbor's midpoint.
                    press()
                    move(220)
                    release(220)
                    expect(onReorder).not.toHaveBeenCalled()

                    press()
                    move(460)
                    release(460)
                    expect(onReorder).toHaveBeenCalledWith(
                        { item: 1, fromIndex: 1, toIndex: 2, source: 'pointer' },
                        { alreadyPreviewed: true },
                    )
                } finally {
                    controller.cleanup()
                    handle.remove()
                }
            }
        })

        it('picks the slot from the given point, including a drop on the activating move', () => {
            const getCollisionPoint = vi.fn(leadingEdge)
            const { handle, controller, onChange, press, move, release, items } = setup({ getCollisionPoint })
            try {
                press()
                move(220)
                expect(getCollisionPoint).toHaveBeenLastCalledWith(
                    { origin: { clientX: 120, clientY: 20 }, position: { clientX: 220, clientY: 20 } },
                    expect.objectContaining({ left: 100, top: 0, right: 400, bottom: 40 }),
                )
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 1, insertionIndex: 3, targetIndex: 2 })
                release(220)
                expect(items()).toEqual([0, 2, 1])
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('follows the given point back across the start and toward the other side', () => {
            const { handle, controller, onChange, onReorder, press, move, release } = setup({
                getCollisionPoint: leadingEdge,
            })
            try {
                press()
                move(220)
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 1, insertionIndex: 3, targetIndex: 2 })
                // The leading edge is back short of the next item's midpoint.
                move(160)
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 1, insertionIndex: 2, targetIndex: 1 })
                // The leading edge has crossed the previous item's midpoint.
                move(60)
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 1, insertionIndex: 0, targetIndex: 0 })
                release(60)
                expect(onReorder).toHaveBeenCalledWith(
                    { item: 1, fromIndex: 1, toIndex: 0, source: 'pointer' },
                    { alreadyPreviewed: true },
                )
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })

        it('keeps the point within the items, while the pointer still decides between dropping and canceling', () => {
            const { handle, controller, onChange, onReorder, press, move, release } = setup({
                getCollisionPoint: leadingEdge,
            })
            try {
                // The leading edge has passed the end of the list.
                press()
                move(380)
                expect(onChange).toHaveBeenLastCalledWith({ draggedIndex: 1, insertionIndex: 3, targetIndex: 2 })

                // Leaving the list with the pointer cancels, although the clamped point stays inside.
                move(380, 120)
                release(380, 120)
                expect(onReorder).not.toHaveBeenCalled()
            } finally {
                controller.cleanup()
                handle.remove()
            }
        })
    })
})
