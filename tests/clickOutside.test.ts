import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { onClickOutside } from '../src/clickOutside'

describe('onClickOutside', () => {
    let container: HTMLElement

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        container.remove()
    })

    function dispatchPointerDown(target: Node) {
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }

    it('should call the callback when clicking outside the element', async () => {
        const target = document.createElement('div')
        container.appendChild(target)

        const callback = vi.fn()
        const cleanup = onClickOutside(target, callback)

        // Wait for the setTimeout to register the listener
        await new Promise((r) => setTimeout(r, 0))

        dispatchPointerDown(document.body)
        expect(callback).toHaveBeenCalledOnce()

        cleanup()
    })

    it('should not call the callback when clicking inside the element', async () => {
        const target = document.createElement('div')
        const child = document.createElement('span')
        target.appendChild(child)
        container.appendChild(target)

        const callback = vi.fn()
        const cleanup = onClickOutside(target, callback)

        await new Promise((r) => setTimeout(r, 0))

        dispatchPointerDown(child)
        expect(callback).not.toHaveBeenCalled()

        dispatchPointerDown(target)
        expect(callback).not.toHaveBeenCalled()

        cleanup()
    })

    it('should accept an array of elements', async () => {
        const target1 = document.createElement('div')
        const target2 = document.createElement('div')
        container.appendChild(target1)
        container.appendChild(target2)

        const callback = vi.fn()
        const cleanup = onClickOutside([target1, target2], callback)

        await new Promise((r) => setTimeout(r, 0))

        dispatchPointerDown(target1)
        expect(callback).not.toHaveBeenCalled()

        dispatchPointerDown(target2)
        expect(callback).not.toHaveBeenCalled()

        dispatchPointerDown(document.body)
        expect(callback).toHaveBeenCalledOnce()

        cleanup()
    })

    it('should not call the callback when clicking inside a portal element', async () => {
        const target = document.createElement('div')
        container.appendChild(target)

        const portal = document.createElement('div')
        portal.setAttribute('data-inertiaui-portal', '')
        const portalChild = document.createElement('button')
        portal.appendChild(portalChild)
        document.body.appendChild(portal)

        const callback = vi.fn()
        const cleanup = onClickOutside(target, callback)

        await new Promise((r) => setTimeout(r, 0))

        dispatchPointerDown(portalChild)
        expect(callback).not.toHaveBeenCalled()

        dispatchPointerDown(portal)
        expect(callback).not.toHaveBeenCalled()

        cleanup()
        portal.remove()
    })

    it('should remove the listener on cleanup', async () => {
        const target = document.createElement('div')
        container.appendChild(target)

        const callback = vi.fn()
        const cleanup = onClickOutside(target, callback)

        await new Promise((r) => setTimeout(r, 0))

        cleanup()

        dispatchPointerDown(document.body)
        expect(callback).not.toHaveBeenCalled()
    })

    it('should be safe to call cleanup multiple times', async () => {
        const target = document.createElement('div')
        container.appendChild(target)

        const callback = vi.fn()
        const cleanup = onClickOutside(target, callback)

        await new Promise((r) => setTimeout(r, 0))

        cleanup()
        cleanup() // should not throw

        dispatchPointerDown(document.body)
        expect(callback).not.toHaveBeenCalled()
    })

    it('should not fire for the click that opened it (same tick)', () => {
        const target = document.createElement('div')
        container.appendChild(target)

        const callback = vi.fn()
        const cleanup = onClickOutside(target, callback)

        // Fire immediately, before setTimeout runs
        dispatchPointerDown(document.body)
        expect(callback).not.toHaveBeenCalled()

        cleanup()
    })

    it('should cleanup the timeout if cleaned up before it fires', () => {
        const target = document.createElement('div')
        container.appendChild(target)

        const callback = vi.fn()
        const cleanup = onClickOutside(target, callback)

        // Cleanup before setTimeout registers the listener
        cleanup()

        // Even after timeout would have fired, no listener should be active
        dispatchPointerDown(document.body)
        expect(callback).not.toHaveBeenCalled()
    })
})
