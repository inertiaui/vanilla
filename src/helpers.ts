export function generateId(prefix = 'inertiaui_'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}${crypto.randomUUID()}`
    }

    // Fallback for environments where crypto.randomUUID is not available
    return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`
}

function strToLowercase(key: string): string {
    return typeof key === 'string' ? key.toLowerCase() : key
}

export function except<T extends Record<string, unknown>>(target: T, keys: string[], ignoreCase?: boolean): Partial<T>
export function except(target: string[], keys: string[], ignoreCase?: boolean): string[]
export function except<T extends Record<string, unknown>>(
    target: T | string[],
    keys: string[],
    ignoreCase = false,
): Partial<T> | string[] {
    if (ignoreCase) {
        keys = keys.map(strToLowercase)
    }

    if (Array.isArray(target)) {
        return target.filter((key) => !keys.includes(ignoreCase ? strToLowercase(key) : key))
    }

    return Object.keys(target).reduce((acc, key) => {
        if (!keys.includes(ignoreCase ? strToLowercase(key) : key)) {
            ;(acc as Record<string, unknown>)[key] = target[key]
        }

        return acc
    }, {} as Partial<T>)
}

export function only<T extends Record<string, unknown>>(target: T, keys: string[], ignoreCase?: boolean): Partial<T>
export function only(target: string[], keys: string[], ignoreCase?: boolean): string[]
export function only<T extends Record<string, unknown>>(
    target: T | string[],
    keys: string[],
    ignoreCase = false,
): Partial<T> | string[] {
    if (ignoreCase) {
        keys = keys.map(strToLowercase)
    }

    if (Array.isArray(target)) {
        return target.filter((key) => keys.includes(ignoreCase ? strToLowercase(key) : key))
    }

    return Object.keys(target).reduce((acc, key) => {
        if (keys.includes(ignoreCase ? strToLowercase(key) : key)) {
            ;(acc as Record<string, unknown>)[key] = target[key]
        }

        return acc
    }, {} as Partial<T>)
}

export function rejectNullValues<T>(target: T[]): NonNullable<T>[]
export function rejectNullValues<T extends Record<string, unknown>>(target: T): Partial<T>
export function rejectNullValues<T extends Record<string, unknown>>(target: T | T[keyof T][]): Partial<T> | unknown[] {
    if (Array.isArray(target)) {
        return target.filter((item) => item !== null)
    }

    return Object.keys(target).reduce((acc, key) => {
        if (key in target && target[key] !== null) {
            ;(acc as Record<string, unknown>)[key] = target[key]
        }
        return acc
    }, {} as Partial<T>)
}

export function kebabCase(string: string): string {
    if (!string) return ''

    // Replace all underscores with hyphens
    string = string.replace(/_/g, '-')

    // Replace all multiple consecutive hyphens with a single hyphen
    string = string.replace(/-+/g, '-')

    // Check if string is already all lowercase
    if (!/[A-Z]/.test(string)) {
        return string
    }

    // Remove all spaces and convert to word case
    string = string
        .replace(/\s+/g, '')
        .replace(/_/g, '')
        .replace(/(?:^|\s|-)+([A-Za-z])/g, (_m, p1: string) => p1.toUpperCase())

    // Add delimiter before uppercase letters
    string = string.replace(/(.)(?=[A-Z])/g, '$1-')

    // Convert to lowercase
    return string.toLowerCase()
}

export function isStandardDomEvent(eventName: string): boolean {
    const lowerEventName = eventName.toLowerCase()
    const standardPatterns = [
        /^on(click|dblclick|mousedown|mouseup|mouseover|mouseout|mousemove|mouseenter|mouseleave)$/,
        /^on(keydown|keyup|keypress)$/,
        /^on(focus|blur|change|input|submit|reset)$/,
        /^on(load|unload|error|resize|scroll)$/,
        /^on(touchstart|touchend|touchmove|touchcancel)$/,
        /^on(pointerdown|pointerup|pointermove|pointerenter|pointerleave|pointercancel)$/,
        /^on(drag|dragstart|dragend|dragenter|dragleave|dragover|drop)$/,
        /^on(animationstart|animationend|animationiteration)$/,
        /^on(transitionstart|transitionend|transitionrun|transitioncancel)$/,
    ]

    return standardPatterns.some((pattern) => pattern.test(lowerEventName))
}
