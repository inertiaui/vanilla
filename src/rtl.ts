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
