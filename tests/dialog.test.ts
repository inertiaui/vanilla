import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { lockScroll, createFocusTrap, onEscapeKey, markAriaHidden } from '../src/dialog'

describe('dialog', () => {
    describe('lockScroll', () => {
        beforeEach(() => {
            document.body.style.overflow = ''
            document.body.style.paddingRight = ''
        })

        it('should lock body scroll', () => {
            const unlock = lockScroll()
            expect(document.body.style.overflow).toBe('hidden')
            unlock()
        })

        it('should support multiple locks', () => {
            const unlock1 = lockScroll()
            const unlock2 = lockScroll()
            expect(document.body.style.overflow).toBe('hidden')

            unlock1()
            expect(document.body.style.overflow).toBe('hidden')

            unlock2()
            expect(document.body.style.overflow).toBe('')
        })

        it('should return an unlock function', () => {
            const unlock = lockScroll()
            expect(document.body.style.overflow).toBe('hidden')
            unlock()
            expect(document.body.style.overflow).toBe('')
        })

        it('should only unlock once per returned function', () => {
            const unlock1 = lockScroll()
            const unlock2 = lockScroll()
            unlock1()
            unlock1() // second call should be a no-op
            expect(document.body.style.overflow).toBe('hidden')
            unlock2()
            expect(document.body.style.overflow).toBe('')
        })

        it('should restore original overflow value', () => {
            document.body.style.overflow = 'auto'
            const unlock = lockScroll()
            expect(document.body.style.overflow).toBe('hidden')
            unlock()
            expect(document.body.style.overflow).toBe('auto')
        })
    })

    describe('createFocusTrap', () => {
        let container: HTMLDivElement

        beforeEach(() => {
            container = document.createElement('div')
            container.innerHTML = `
                <button id="first">First</button>
                <input id="middle" type="text" />
                <button id="last">Last</button>
            `
            document.body.appendChild(container)
        })

        afterEach(() => {
            document.body.removeChild(container)
        })

        it('should return a cleanup function', () => {
            const cleanup = createFocusTrap(container)
            expect(typeof cleanup).toBe('function')
            cleanup()
        })

        it('should trap Tab key to focusable elements', () => {
            const cleanup = createFocusTrap(container, { initialFocus: false })
            const last = container.querySelector('#last') as HTMLElement
            last.focus()

            const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
            document.dispatchEvent(event)

            expect(preventDefaultSpy).toHaveBeenCalled()
            cleanup()
        })

        it('should trap Shift+Tab to last element', () => {
            const cleanup = createFocusTrap(container, { initialFocus: false })
            const first = container.querySelector('#first') as HTMLElement
            first.focus()

            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
            document.dispatchEvent(event)

            expect(preventDefaultSpy).toHaveBeenCalled()
            cleanup()
        })

        it('should ignore non-Tab keys', () => {
            const cleanup = createFocusTrap(container, { initialFocus: false })

            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
            document.dispatchEvent(event)

            expect(preventDefaultSpy).not.toHaveBeenCalled()
            cleanup()
        })

        it('should redirect focus back into container', () => {
            const cleanup = createFocusTrap(container, { initialFocus: false })
            const outside = document.createElement('button')
            document.body.appendChild(outside)

            const event = new FocusEvent('focusin', { relatedTarget: outside, bubbles: true })
            Object.defineProperty(event, 'target', { value: outside })
            document.dispatchEvent(event)

            cleanup()
            document.body.removeChild(outside)
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
            const cleanup = markAriaHidden(element)
            expect(element.getAttribute('aria-hidden')).toBe('true')
            cleanup()
        })

        it('should accept selector string', () => {
            const cleanup = markAriaHidden('#test-element')
            expect(element.getAttribute('aria-hidden')).toBe('true')
            cleanup()
        })

        it('should return cleanup function that removes aria-hidden', () => {
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
})
