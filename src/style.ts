import { captureStyleProperty, restoreStyleProperty } from './position/style'
import type { StoredStyleProperty } from './position/types'

export interface InlineStyleSnapshot {
    /** Put back the captured inline values and priorities, of every captured property or only of the given ones. */
    restore: (properties?: readonly string[]) => void
}

/**
 * Remember an element's inline values for some CSS properties, with their
 * priorities, so temporary changes can be undone without touching other inline
 * styles. Name properties as in CSS, such as `z-index`.
 */
export function captureInlineStyles(element: HTMLElement, properties: readonly string[]): InlineStyleSnapshot {
    const names = properties.slice()
    const stored: StoredStyleProperty[] = names.map((property) => captureStyleProperty(element.style, property))

    return {
        restore: (only) => {
            if (!only) {
                names.forEach((property, index) => restoreStyleProperty(element.style, property, stored[index]!))

                return
            }

            for (const property of only) {
                const index = names.indexOf(property)

                if (index !== -1) {
                    restoreStyleProperty(element.style, property, stored[index]!)
                }
            }
        },
    }
}
