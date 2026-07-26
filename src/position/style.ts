import type { StoredStyleProperty } from './types'

export function setStyleProperty(style: CSSStyleDeclaration, property: string, value: string): void {
    if (style.getPropertyValue(property) !== value) {
        style.setProperty(property, value)
    }
}

export function removeStyleProperty(style: CSSStyleDeclaration, property: string): void {
    if (style.getPropertyValue(property) !== '') {
        style.removeProperty(property)
    }
}

export function captureStyleProperty(style: CSSStyleDeclaration, property: string): StoredStyleProperty {
    return {
        value: style.getPropertyValue(property),
        priority: style.getPropertyPriority(property),
    }
}

export function restoreStyleProperty(style: CSSStyleDeclaration, property: string, stored: StoredStyleProperty): void {
    if (stored.value === '') {
        removeStyleProperty(style, property)

        return
    }

    style.setProperty(property, stored.value, stored.priority)
}
