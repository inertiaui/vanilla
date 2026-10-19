import type { CleanupFunction } from './dialog'

/**
 * Check whether the document is currently in RTL direction.
 */
export function isRtl(): boolean {
    return document.documentElement.dir === 'rtl'
}

/**
 * Observe changes to the document's `dir` attribute and invoke the callback
 * whenever it changes. Returns a cleanup function to stop observing.
 */
export function onRtlChange(callback: (rtl: boolean) => void): CleanupFunction {
    const observer = new MutationObserver(() => {
        callback(document.documentElement.dir === 'rtl')
    })

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['dir'],
    })

    return () => observer.disconnect()
}

/**
 * Give a panel rendered away from its reference, such as in the body, the
 * direction the reference is written in. A panel with its own `dir` keeps it.
 * Returns a cleanup function that removes the direction again.
 */
export function followReferenceDirection(reference: Element, panel: HTMLElement): CleanupFunction {
    const direction = getComputedStyle(reference).direction

    if (panel.hasAttribute('dir') || getComputedStyle(panel).direction === direction) {
        return () => {}
    }

    panel.setAttribute('dir', direction)

    return () => {
        if (panel.getAttribute('dir') === direction) {
            panel.removeAttribute('dir')
        }
    }
}
