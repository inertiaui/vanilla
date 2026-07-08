import { createReorderableList, REORDERABLE_LIST_HANDLE_ATTRIBUTE } from '../src/reorder'

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

    it('auto-scrolls while pointer dragging', () => {
        let frame: FrameRequestCallback | null = null
        const container = document.createElement('div')
        const handle = document.createElement('button')
        let items = ['alpha', 'beta']
        const controller = createReorderableList({
            getItems: () => items,
            setItems: (nextItems) => {
                items = nextItems
            },
            autoScroll: {
                getScrollContainers: () => [container],
            },
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
        for (const index of [0, 1]) {
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

        controller.pointerDown(
            0,
            makeEvent('pointerdown', [handle, container, document.body, document, window], container),
        )
        window.dispatchEvent(makeEvent('pointermove', [window], window, { pointerId: 1, clientX: 50, clientY: 98 }))

        frame?.(16)

        expect(container.scrollTop).toBeGreaterThan(0)

        controller.cleanup()
        container.remove()
    })
})
