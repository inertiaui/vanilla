const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ')

let scrollLockCount = 0
let originalOverflow = ''
let originalPaddingRight = ''

export type CleanupFunction = () => void

export function lockScroll(): CleanupFunction {
    if (scrollLockCount === 0) {
        originalOverflow = document.body.style.overflow
        originalPaddingRight = document.body.style.paddingRight

        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        document.body.style.overflow = 'hidden'

        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`
        }
    }

    scrollLockCount++

    let unlocked = false
    return function unlock() {
        if (unlocked) {
            return
        }
        unlocked = true
        unlockScroll()
    }
}

export function unlockScroll(): void {
    scrollLockCount = Math.max(0, scrollLockCount - 1)

    if (scrollLockCount === 0) {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
    }
}

export function getScrollLockCount(): number {
    return scrollLockCount
}

/**
 * Reset scroll lock state. Useful for HMR scenarios where module state
 * can get out of sync when a modal is open during hot reload.
 */
export function resetScrollLockState(): void {
    if (scrollLockCount > 0) {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
    }
    scrollLockCount = 0
    originalOverflow = ''
    originalPaddingRight = ''
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) {
        return []
    }

    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
        (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'),
    )
}

export interface FocusTrapOptions {
    initialFocus?: boolean
    initialFocusElement?: HTMLElement | null
    returnFocus?: boolean
}

export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): CleanupFunction {
    const { initialFocus = true, initialFocusElement = null, returnFocus = true } = options
    const previouslyFocused = document.activeElement as HTMLElement | null

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Tab') {
            return
        }

        const focusableElements = getFocusableElements(container)
        if (focusableElements.length === 0) {
            return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (event.shiftKey) {
            if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
                event.preventDefault()
                lastElement.focus()
            }
        } else {
            if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
                event.preventDefault()
                firstElement.focus()
            }
        }
    }

    function handleFocusIn(event: FocusEvent) {
        if (!container.contains(event.target as Node)) {
            const focusableElements = getFocusableElements(container)
            if (focusableElements.length > 0) {
                focusableElements[0].focus()
            }
        }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)

    if (initialFocus) {
        requestAnimationFrame(() => {
            if (initialFocusElement && container.contains(initialFocusElement)) {
                initialFocusElement.focus()
            } else {
                const focusableElements = getFocusableElements(container)
                if (focusableElements.length > 0) {
                    focusableElements[0].focus()
                }
            }
        })
    }

    return function cleanup() {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('focusin', handleFocusIn)

        if (returnFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') {
            previouslyFocused.focus()
        }
    }
}

export function focusFirstElement(container: HTMLElement): boolean {
    const focusableElements = getFocusableElements(container)

    if (focusableElements.length > 0) {
        focusableElements[0].focus()
        return true
    }

    return false
}

export interface ClickOutsideOptions {
    event?: 'mousedown' | 'mouseup' | 'click'
    capture?: boolean
}

export function onClickOutside(
    element: HTMLElement | null,
    callback: (event: MouseEvent) => void,
    options: ClickOutsideOptions = {},
): CleanupFunction {
    const { event = 'mousedown', capture = true } = options

    function handler(e: MouseEvent) {
        if (!element || element.contains(e.target as Node)) {
            return
        }
        callback(e)
    }

    document.addEventListener(event, handler, capture)

    return function cleanup() {
        document.removeEventListener(event, handler, capture)
    }
}

export interface EscapeKeyOptions {
    preventDefault?: boolean
    stopPropagation?: boolean
}

export function onEscapeKey(callback: (event: KeyboardEvent) => void, options: EscapeKeyOptions = {}): CleanupFunction {
    const { preventDefault = false, stopPropagation = false } = options

    function handler(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            if (preventDefault) {
                event.preventDefault()
            }
            if (stopPropagation) {
                event.stopPropagation()
            }
            callback(event)
        }
    }

    document.addEventListener('keydown', handler)

    return function cleanup() {
        document.removeEventListener('keydown', handler)
    }
}

interface AriaHiddenStackItem {
    element: Element
    originalValue: string | null
    count: number
}

const ariaHiddenStack: AriaHiddenStackItem[] = []

export function markAriaHidden(elementOrSelector: Element | string): CleanupFunction {
    const element = typeof elementOrSelector === 'string' ? document.querySelector(elementOrSelector) : elementOrSelector

    if (!element) {
        return function noop() {}
    }

    const existingIndex = ariaHiddenStack.findIndex((item) => item.element === element)

    if (existingIndex >= 0) {
        ariaHiddenStack[existingIndex].count++
    } else {
        const originalValue = element.getAttribute('aria-hidden')
        ariaHiddenStack.push({ element, originalValue, count: 1 })
        element.setAttribute('aria-hidden', 'true')
    }

    let cleaned = false
    return function cleanup() {
        if (cleaned) {
            return
        }
        cleaned = true
        unmarkAriaHidden(element)
    }
}

export function unmarkAriaHidden(element: Element): void {
    const index = ariaHiddenStack.findIndex((item) => item.element === element)

    if (index < 0) {
        return
    }

    ariaHiddenStack[index].count--

    if (ariaHiddenStack[index].count <= 0) {
        const { originalValue } = ariaHiddenStack[index]

        if (originalValue === null) {
            element.removeAttribute('aria-hidden')
        } else {
            element.setAttribute('aria-hidden', originalValue)
        }
        ariaHiddenStack.splice(index, 1)
    }
}

export interface DialogOptions {
    appElement?: string | null
    closeOnEscape?: boolean
    closeOnClickOutside?: boolean
    trapFocus?: boolean
    lockScroll?: boolean
    initialFocus?: boolean
    initialFocusElement?: HTMLElement | null
    returnFocus?: boolean
    onClose?: (() => void) | null
}

export interface Dialog {
    activate: () => void
    deactivate: () => void
    readonly isActive: boolean
}

/**
 * Parses CSS duration values and returns maximum duration in milliseconds.
 * Handles single values like "0.3s" and multiple values like "0s, 0.3s, 300ms"
 */
function parseMaxDuration(durationStr: string): number {
    const durations = durationStr.split(',').map((d) => d.trim())
    let maxMs = 0

    for (const duration of durations) {
        const match = duration.match(/^([\d.]+)(s|ms)$/)
        if (match) {
            const value = parseFloat(match[1])
            const ms = match[2] === 's' ? value * 1000 : value
            maxMs = Math.max(maxMs, ms)
        }
    }

    return maxMs
}

/**
 * Waits for a CSS transition to complete on an element, then calls the callback.
 * Falls back to immediate callback if:
 * - transition-duration is 0ms
 * - the element has no computed transition
 * - the transition doesn't start within a reasonable time
 */
export function onTransitionEnd(element: HTMLElement, callback: () => void): CleanupFunction {
    // Get the computed transition duration
    const computedStyle = window.getComputedStyle(element)
    const transitionDuration = computedStyle.transitionDuration || '0s'

    // Parse duration - could be "0s", "0.3s", "300ms", or comma-separated list
    const durationMs = parseMaxDuration(transitionDuration)

    // If duration is 0 or very small, call immediately
    if (durationMs < 10) {
        // Use requestAnimationFrame to ensure any pending state changes are flushed
        const frameId = requestAnimationFrame(() => callback())
        return () => cancelAnimationFrame(frameId)
    }

    let called = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const handler = (event: TransitionEvent) => {
        if (event.target !== element) return
        if (called) return
        called = true

        element.removeEventListener('transitionend', handler)
        if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
        }
        callback()
    }

    element.addEventListener('transitionend', handler)

    // Safety timeout - if transition doesn't complete within expected duration + buffer
    timeoutId = setTimeout(() => {
        if (called) return
        called = true
        element.removeEventListener('transitionend', handler)
        callback()
    }, durationMs + 100)

    return () => {
        element.removeEventListener('transitionend', handler)
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

export function createDialog(dialogElement: HTMLElement, options: DialogOptions = {}): Dialog {
    const {
        appElement = '#app',
        closeOnEscape = true,
        closeOnClickOutside = true,
        trapFocus = true,
        lockScroll: shouldLockScroll = true,
        initialFocus = true,
        initialFocusElement = null,
        returnFocus = true,
        onClose = null,
    } = options

    const cleanupFunctions: CleanupFunction[] = []
    let isActive = false

    function activate() {
        if (isActive) {
            return
        }
        isActive = true

        if (shouldLockScroll) {
            cleanupFunctions.push(lockScroll())
        }

        if (appElement) {
            cleanupFunctions.push(markAriaHidden(appElement))
        }

        if (trapFocus) {
            cleanupFunctions.push(
                createFocusTrap(dialogElement, {
                    initialFocus,
                    initialFocusElement,
                    returnFocus,
                }),
            )
        }

        if (closeOnEscape && onClose) {
            cleanupFunctions.push(onEscapeKey(onClose))
        }

        if (closeOnClickOutside && onClose) {
            cleanupFunctions.push(onClickOutside(dialogElement, onClose))
        }
    }

    function deactivate() {
        if (!isActive) {
            return
        }
        isActive = false

        while (cleanupFunctions.length > 0) {
            const cleanup = cleanupFunctions.pop()
            if (typeof cleanup === 'function') {
                cleanup()
            }
        }
    }

    return {
        activate,
        deactivate,
        get isActive() {
            return isActive
        },
    }
}
