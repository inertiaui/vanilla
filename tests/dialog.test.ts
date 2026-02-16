import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    lockScroll,
    unlockScroll,
    getScrollLockCount,
    getFocusableElements,
    onClickOutside,
    onEscapeKey,
    markAriaHidden,
    unmarkAriaHidden,
} from '../src/dialog'

describe('dialog', () => {
    beforeEach(() => {
        // Reset scroll lock state
        while (getScrollLockCount() > 0) {
            unlockScroll()
        }
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
    })

    describe('lockScroll', () => {
        it('should lock body scroll', () => {
            lockScroll()
            expect(document.body.style.overflow).toBe('hidden')
            expect(getScrollLockCount()).toBe(1)
        })

        it('should support multiple locks', () => {
            lockScroll()
            lockScroll()
            expect(getScrollLockCount()).toBe(2)
            expect(document.body.style.overflow).toBe('hidden')
        })

        it('should return an unlock function', () => {
            const unlock = lockScroll()
            expect(getScrollLockCount()).toBe(1)
            unlock()
            expect(getScrollLockCount()).toBe(0)
        })

        it('should only unlock once per returned function', () => {
            const unlock = lockScroll()
            unlock()
            unlock()
            expect(getScrollLockCount()).toBe(0)
        })
    })

    describe('unlockScroll', () => {
        it('should decrement lock count', () => {
            lockScroll()
            lockScroll()
            unlockScroll()
            expect(getScrollLockCount()).toBe(1)
        })

        it('should restore overflow when count reaches 0', () => {
            document.body.style.overflow = 'auto'
            lockScroll()
            unlockScroll()
            expect(document.body.style.overflow).toBe('auto')
        })

        it('should not go below 0', () => {
            unlockScroll()
            unlockScroll()
            expect(getScrollLockCount()).toBe(0)
        })
    })

    describe('getFocusableElements', () => {
        it('should return empty array for null container', () => {
            expect(getFocusableElements(null)).toEqual([])
        })

        it('should find focusable elements', () => {
            const container = document.createElement('div')
            container.innerHTML = `
                <button>Button</button>
                <a href="#">Link</a>
                <input type="text" />
                <textarea></textarea>
                <select><option>Option</option></select>
                <div tabindex="0">Focusable div</div>
                <div tabindex="-1">Not focusable</div>
                <button disabled>Disabled button</button>
            `
            document.body.appendChild(container)

            const focusable = getFocusableElements(container)
            expect(focusable.length).toBe(6)

            document.body.removeChild(container)
        })

        it('should exclude elements with aria-hidden', () => {
            const container = document.createElement('div')
            container.innerHTML = `
                <button>Visible</button>
                <button aria-hidden="true">Hidden</button>
            `
            document.body.appendChild(container)

            const focusable = getFocusableElements(container)
            expect(focusable.length).toBe(1)

            document.body.removeChild(container)
        })
    })

    describe('onClickOutside', () => {
        it('should call callback when clicking outside element', () => {
            const element = document.createElement('div')
            document.body.appendChild(element)

            const callback = vi.fn()
            const cleanup = onClickOutside(element, callback)

            const event = new MouseEvent('mousedown', { bubbles: true })
            document.body.dispatchEvent(event)

            expect(callback).toHaveBeenCalled()

            cleanup()
            document.body.removeChild(element)
        })

        it('should not call callback when clicking inside element', () => {
            const element = document.createElement('div')
            document.body.appendChild(element)

            const callback = vi.fn()
            const cleanup = onClickOutside(element, callback)

            const event = new MouseEvent('mousedown', { bubbles: true })
            element.dispatchEvent(event)

            expect(callback).not.toHaveBeenCalled()

            cleanup()
            document.body.removeChild(element)
        })

        it('should cleanup event listener', () => {
            const element = document.createElement('div')
            document.body.appendChild(element)

            const callback = vi.fn()
            const cleanup = onClickOutside(element, callback)
            cleanup()

            const event = new MouseEvent('mousedown', { bubbles: true })
            document.body.dispatchEvent(event)

            expect(callback).not.toHaveBeenCalled()

            document.body.removeChild(element)
        })
    })

    describe('onEscapeKey', () => {
        it('should call callback on Escape key', () => {
            const callback = vi.fn()
            const cleanup = onEscapeKey(callback)

            const event = new KeyboardEvent('keydown', { key: 'Escape' })
            document.dispatchEvent(event)

            expect(callback).toHaveBeenCalled()

            cleanup()
        })

        it('should not call callback on other keys', () => {
            const callback = vi.fn()
            const cleanup = onEscapeKey(callback)

            const event = new KeyboardEvent('keydown', { key: 'Enter' })
            document.dispatchEvent(event)

            expect(callback).not.toHaveBeenCalled()

            cleanup()
        })

        it('should cleanup event listener', () => {
            const callback = vi.fn()
            const cleanup = onEscapeKey(callback)
            cleanup()

            const event = new KeyboardEvent('keydown', { key: 'Escape' })
            document.dispatchEvent(event)

            expect(callback).not.toHaveBeenCalled()
        })

        it('should support preventDefault option', () => {
            const callback = vi.fn()
            const cleanup = onEscapeKey(callback, { preventDefault: true })

            const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
            document.dispatchEvent(event)

            expect(preventDefaultSpy).toHaveBeenCalled()

            cleanup()
        })
    })

    describe('markAriaHidden', () => {
        let element: HTMLDivElement

        beforeEach(() => {
            element = document.createElement('div')
            element.id = 'test-element'
            document.body.appendChild(element)
        })

        afterEach(() => {
            if (element.parentNode) {
                document.body.removeChild(element)
            }
        })

        it('should mark element as aria-hidden', () => {
            markAriaHidden(element)
            expect(element.getAttribute('aria-hidden')).toBe('true')
        })

        it('should accept selector string', () => {
            markAriaHidden('#test-element')
            expect(element.getAttribute('aria-hidden')).toBe('true')
        })

        it('should return cleanup function', () => {
            const cleanup = markAriaHidden(element)
            expect(element.getAttribute('aria-hidden')).toBe('true')
            cleanup()
            expect(element.getAttribute('aria-hidden')).toBeNull()
        })

        it('should restore original aria-hidden value', () => {
            element.setAttribute('aria-hidden', 'false')
            const cleanup = markAriaHidden(element)
            expect(element.getAttribute('aria-hidden')).toBe('true')
            cleanup()
            expect(element.getAttribute('aria-hidden')).toBe('false')
        })

        it('should support ref counting for same element', () => {
            const cleanup1 = markAriaHidden(element)
            const cleanup2 = markAriaHidden(element)

            cleanup1()
            expect(element.getAttribute('aria-hidden')).toBe('true')

            cleanup2()
            expect(element.getAttribute('aria-hidden')).toBeNull()
        })

        it('should return noop for non-existent selector', () => {
            const cleanup = markAriaHidden('#non-existent')
            expect(typeof cleanup).toBe('function')
            cleanup() // Should not throw
        })
    })

    describe('unmarkAriaHidden', () => {
        let element: HTMLDivElement

        beforeEach(() => {
            element = document.createElement('div')
            document.body.appendChild(element)
        })

        afterEach(() => {
            if (element.parentNode) {
                document.body.removeChild(element)
            }
        })

        it('should remove aria-hidden', () => {
            markAriaHidden(element)
            unmarkAriaHidden(element)
            expect(element.getAttribute('aria-hidden')).toBeNull()
        })

        it('should do nothing for element not in stack', () => {
            unmarkAriaHidden(element)
            expect(element.getAttribute('aria-hidden')).toBeNull()
        })
    })
})
