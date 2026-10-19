const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
]
    .map((selector) => `${selector}:not([aria-hidden="true"]):not(input[type="hidden"])`)
    .join(', ')

let scrollLockCount = 0
let originalOverflow = ''
let originalPaddingRight = ''
let originalScrollbarGutter = ''

export type CleanupFunction = () => void

function supportsScrollbarGutter(): boolean {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('scrollbar-gutter: stable')
}

export function lockScroll(): CleanupFunction {
    if (scrollLockCount === 0) {
        originalOverflow = document.body.style.overflow
        originalPaddingRight = document.body.style.paddingRight
        originalScrollbarGutter = document.documentElement.style.getPropertyValue('scrollbar-gutter')

        const canReserveScrollbarGutter = supportsScrollbarGutter()
        const scrollbarWidth = canReserveScrollbarGutter ? 0 : window.innerWidth - document.documentElement.clientWidth

        if (canReserveScrollbarGutter) {
            document.documentElement.style.setProperty('scrollbar-gutter', 'stable')
        }

        document.body.style.overflow = 'hidden'

        if (!canReserveScrollbarGutter && scrollbarWidth > 0) {
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

        if (originalScrollbarGutter) {
            document.documentElement.style.setProperty('scrollbar-gutter', originalScrollbarGutter)
        } else {
            document.documentElement.style.removeProperty('scrollbar-gutter')
        }
    }
}

function getLastFocusableElement(container: HTMLElement): HTMLElement | null {
    let element: Element | null = container.lastElementChild
    let descend = true

    // Most dialogs end with a control. Search backwards in document order without
    // collecting every control, but bound JS traversal for long decorative tails.
    // Query the live DOM on every event so inserted/disabled controls are respected.
    for (let remaining = 32; element && remaining > 0; remaining--) {
        if (descend && element.lastElementChild) {
            element = element.lastElementChild
            continue
        }
        if (element.matches(FOCUSABLE_SELECTORS)) {
            return element as HTMLElement
        }
        if (element.previousElementSibling) {
            element = element.previousElementSibling
            descend = true
        } else {
            element = element.parentElement
            if (element === container) return null
            descend = false
        }
    }

    if (!element) return null
    const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    return elements[elements.length - 1] ?? null
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
    const activeElement = document.activeElement
    const outside = !container.contains(activeElement)

    if (!event.shiftKey && outside) {
        const firstElement = container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)
        if (firstElement) {
            event.preventDefault()
            firstElement.focus()
        }
        return
    }

    if (event.shiftKey && !outside && activeElement !== container.querySelector(FOCUSABLE_SELECTORS)) {
        return
    }

    const lastElement = getLastFocusableElement(container)
    if (!lastElement) return
    if (event.shiftKey) {
        event.preventDefault()
        lastElement.focus()
    } else if (activeElement === lastElement) {
        event.preventDefault()
        container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)?.focus()
    }
}

function handleTrapFocusIn(event: FocusEvent) {
    if (focusTrapStack.length === 0) {
        return
    }

    const { container } = focusTrapStack[focusTrapStack.length - 1]
    if (!container.contains(event.target as Node)) {
        container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)?.focus({ preventScroll: true })
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
            // Cleanup or a newly opened trap may have transferred focus ownership
            // since the blur event. Do not let stale recovery steal focus back.
            if (cleaned || focusTrapStack[focusTrapStack.length - 1] !== entry) {
                return
            }

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

            container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)?.focus({ preventScroll: true })
        })
    }

    container.addEventListener('focusout', handleFocusOut)

    let rafId: number | undefined
    if (initialFocus) {
        rafId = requestAnimationFrame(() => {
            rafId = undefined
            if (focusTrapStack[focusTrapStack.length - 1] !== entry) {
                return
            }
            if (initialFocusElement && container.contains(initialFocusElement)) {
                initialFocusElement.focus()
            } else {
                container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)?.focus()
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

        if (focusTrapStack[focusTrapStack.length - 1] === entry) {
            focusTrapStack.pop()
        } else {
            const index = focusTrapStack.indexOf(entry)
            if (index >= 0) {
                focusTrapStack.splice(index, 1)
            }
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
    let abortController: AbortController | null = null
    let listening = false

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

    if (typeof AbortController !== 'undefined') {
        try {
            abortController = new AbortController()
            document.addEventListener('keydown', handler, { signal: abortController.signal })
            listening = true
        } catch {
            abortController = null
        }
    }

    if (!listening) {
        document.addEventListener('keydown', handler)
        listening = true
    }

    return function cleanup() {
        if (abortController) {
            abortController.abort()
        } else {
            document.removeEventListener('keydown', handler)
        }
    }
}

interface AriaHiddenState {
    originalValue: string | null
    count: number
}

interface InertState {
    originalAriaHidden: string | null
    originalInert: boolean
    count: number
}

const ariaHiddenStates = new WeakMap<Element, AriaHiddenState>()
const inertStates = new WeakMap<HTMLElement, InertState>()

type NativeInertElement = HTMLElement & { inert: boolean }

function supportsNativeInert(element: HTMLElement): boolean {
    return 'inert' in element
}

export function markAriaHidden(elementOrSelector: Element | string): CleanupFunction {
    const element =
        typeof elementOrSelector === 'string' ? document.querySelector(elementOrSelector) : elementOrSelector

    if (!element) {
        return function noop() {}
    }

    const existing = ariaHiddenStates.get(element)

    if (existing) {
        existing.count++
    } else {
        const originalValue = element.getAttribute('aria-hidden')
        ariaHiddenStates.set(element, { originalValue, count: 1 })
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
    const item = ariaHiddenStates.get(element)

    if (!item) {
        return
    }

    item.count--

    if (item.count <= 0) {
        const { originalValue } = item

        if (originalValue === null) {
            element.removeAttribute('aria-hidden')
        } else {
            element.setAttribute('aria-hidden', originalValue)
        }
        ariaHiddenStates.delete(element)
    }
}

export function markInert(elementOrSelector: HTMLElement | string): CleanupFunction {
    const element =
        typeof elementOrSelector === 'string'
            ? document.querySelector<HTMLElement>(elementOrSelector)
            : elementOrSelector

    if (!element) {
        return function noop() {}
    }

    const existing = inertStates.get(element)

    if (existing) {
        existing.count++
    } else {
        const originalAriaHidden = element.getAttribute('aria-hidden')
        const hasNativeInert = supportsNativeInert(element)
        const originalInert = hasNativeInert ? (element as NativeInertElement).inert : false

        inertStates.set(element, { originalAriaHidden, originalInert, count: 1 })

        if (hasNativeInert) {
            ;(element as NativeInertElement).inert = true
        } else {
            element.setAttribute('aria-hidden', 'true')
        }
    }

    let cleaned = false
    return function cleanup() {
        if (cleaned) {
            return
        }
        cleaned = true
        unmarkInert(element)
    }
}

function unmarkInert(element: HTMLElement): void {
    const item = inertStates.get(element)

    if (!item) {
        return
    }

    item.count--

    if (item.count <= 0) {
        const { originalAriaHidden, originalInert } = item

        if (supportsNativeInert(element)) {
            ;(element as NativeInertElement).inert = originalInert
        }

        if (originalAriaHidden === null) {
            element.removeAttribute('aria-hidden')
        } else {
            element.setAttribute('aria-hidden', originalAriaHidden)
        }

        inertStates.delete(element)
    }
}
