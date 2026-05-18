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

function unlockScroll(): void {
    scrollLockCount = Math.max(0, scrollLockCount - 1)

    if (scrollLockCount === 0) {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
    }
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
    if (!container) {
        return []
    }

    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
        (el) => el.getAttribute('aria-hidden') !== 'true',
    )
}

export interface FocusTrapOptions {
    initialFocus?: boolean
    initialFocusElement?: HTMLElement | null
    returnFocus?: boolean
}

interface FocusTrapEntry {
    container: HTMLElement
}

const focusTrapStack: FocusTrapEntry[] = []

// Tracks the most recent pointerdown target so the focus trap can distinguish
// "focus escaped the container" (recapture) from "user clicked a non-focusable
// area inside the container" (leave focus alone — recapturing would scroll the
// container back to the top).
let lastPointerDownTarget: EventTarget | null = null

function trackPointerDown(event: PointerEvent): void {
    lastPointerDownTarget = event.target
    // Clear after the current task. The synchronous focusout dispatched as the
    // default action of this pointerdown still observes the target (captured
    // into a closure before any later turn of the event loop), but unrelated
    // focusouts in later tasks see a cleared value and recapture correctly.
    setTimeout(() => {
        if (lastPointerDownTarget === event.target) {
            lastPointerDownTarget = null
        }
    }, 0)
}

function handleTrapKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || focusTrapStack.length === 0) {
        return
    }

    const { container } = focusTrapStack[focusTrapStack.length - 1]
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

function handleTrapFocusIn(event: FocusEvent) {
    if (focusTrapStack.length === 0) {
        return
    }

    const { container } = focusTrapStack[focusTrapStack.length - 1]
    if (!container.contains(event.target as Node)) {
        const focusableElements = getFocusableElements(container)
        if (focusableElements.length > 0) {
            focusableElements[0].focus({ preventScroll: true })
        }
    }
}

export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): CleanupFunction {
    const { initialFocus = true, initialFocusElement = null, returnFocus = true } = options
    const previouslyFocused = document.activeElement as HTMLElement | null

    const entry: FocusTrapEntry = { container }

    if (focusTrapStack.length === 0) {
        document.addEventListener('keydown', handleTrapKeyDown)
        document.addEventListener('focusin', handleTrapFocusIn)
        document.addEventListener('pointerdown', trackPointerDown, true)
    }

    focusTrapStack.push(entry)

    // Handle focus escaping the trap entirely (e.g. Tab at boundary in some browsers)
    function handleFocusOut(event: FocusEvent) {
        if (event.relatedTarget !== null) {
            return
        }

        const pointerTarget = lastPointerDownTarget

        // Focus went to void — recapture it
        queueMicrotask(() => {
            if (container.contains(container.ownerDocument.activeElement)) {
                return
            }

            // User clicked a non-focusable area inside the container (e.g. a label,
            // padding, or plain text). Leave focus where the browser put it instead
            // of recapturing — recapturing focuses the first focusable element,
            // which scrolls the container back to the top of a long modal.
            if (pointerTarget instanceof Node && container.contains(pointerTarget)) {
                return
            }

            const focusableElements = getFocusableElements(container)
            if (focusableElements.length > 0) {
                focusableElements[0].focus({ preventScroll: true })
            }
        })
    }

    container.addEventListener('focusout', handleFocusOut)

    let rafId: number | undefined
    if (initialFocus) {
        rafId = requestAnimationFrame(() => {
            rafId = undefined
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

    let cleaned = false
    return function cleanup() {
        if (cleaned) {
            return
        }
        cleaned = true

        if (rafId !== undefined) {
            cancelAnimationFrame(rafId)
        }

        container.removeEventListener('focusout', handleFocusOut)

        const index = focusTrapStack.indexOf(entry)
        if (index >= 0) {
            focusTrapStack.splice(index, 1)
        }

        if (focusTrapStack.length === 0) {
            document.removeEventListener('keydown', handleTrapKeyDown)
            document.removeEventListener('focusin', handleTrapFocusIn)
            document.removeEventListener('pointerdown', trackPointerDown, true)
            lastPointerDownTarget = null
        }

        if (
            returnFocus &&
            previouslyFocused &&
            typeof previouslyFocused.focus === 'function' &&
            previouslyFocused.isConnected
        ) {
            previouslyFocused.focus()
        }
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
    const element =
        typeof elementOrSelector === 'string' ? document.querySelector(elementOrSelector) : elementOrSelector

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

function unmarkAriaHidden(element: Element): void {
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
