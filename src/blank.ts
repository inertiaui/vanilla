/**
 * Port of Laravel's `blank` function.
 * Returns true if the value is "empty" — null, undefined, empty string, empty array/object, etc.
 */
export function blank(value: unknown): boolean {
    if (value === null || value === undefined) {
        return true
    }

    if (typeof value === 'string') {
        return value.trim() === ''
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return false
    }

    if (
        Array.isArray(value) ||
        (typeof value === 'object' && value !== null && typeof (value as ArrayLike<unknown>).length === 'number')
    ) {
        return (value as ArrayLike<unknown>).length === 0
    }

    return !value
}
