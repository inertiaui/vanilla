import { describe, expect, it } from 'vitest'

import { evaluateVisibility, resolveVisibilityPath } from '../src/visibility'
import type { Visibility, VisibilityResolver } from '../src/visibility'

function resolverFor(data: Record<string, unknown>, rootData: Record<string, unknown> = data): VisibilityResolver {
    return (path) => resolveVisibilityPath(path, data, rootData)
}

describe('resolveVisibilityPath', () => {
    const data = { name: 'child', nested: { value: 1 } }
    const root = { name: 'root', top: 'T' }

    it('returns the root data for "$"', () => {
        expect(resolveVisibilityPath('$', data, root)).toBe(root)
    })

    it('resolves "$.path" against the root data', () => {
        expect(resolveVisibilityPath('$.top', data, root)).toBe('T')
    })

    it('resolves a plain path against the local data', () => {
        expect(resolveVisibilityPath('name', data, root)).toBe('child')
        expect(resolveVisibilityPath('nested.value', data, root)).toBe(1)
    })

    it('defaults rootData to data', () => {
        expect(resolveVisibilityPath('$', data)).toBe(data)
    })

    it('returns the source when the path is empty', () => {
        const source = { a: 1 }
        expect(resolveVisibilityPath('', source)).toBe(source)
    })

    it('prefers a direct key match over dot splitting', () => {
        const source = { 'a.b': 'direct', a: { b: 'nested' } }
        expect(resolveVisibilityPath('a.b', source)).toBe('direct')
    })

    it('splits on dots when there is no direct key', () => {
        expect(resolveVisibilityPath('a.b.c', { a: { b: { c: 42 } } })).toBe(42)
    })

    it('indexes into arrays with numeric segments', () => {
        expect(resolveVisibilityPath('items.1', { items: ['x', 'y', 'z'] })).toBe('y')
    })

    it('returns undefined for non-integer array segments', () => {
        expect(resolveVisibilityPath('items.foo', { items: ['x'] })).toBeUndefined()
    })

    it('returns undefined when traversing through null/undefined', () => {
        expect(resolveVisibilityPath('a.b', { a: null })).toBeUndefined()
        expect(resolveVisibilityPath('a.b', {})).toBeUndefined()
    })

    it('returns undefined for empty segments', () => {
        expect(resolveVisibilityPath('a..b', { a: { b: 1 } })).toBeUndefined()
    })

    it('returns undefined when descending into a primitive', () => {
        expect(resolveVisibilityPath('a.b', { a: 5 })).toBeUndefined()
    })
})

describe('evaluateVisibility', () => {
    it('returns true when visibility is null or undefined', () => {
        expect(evaluateVisibility(null, () => undefined)).toBe(true)
        expect(evaluateVisibility(undefined, () => undefined)).toBe(true)
    })

    const check = (visibility: Visibility, data: Record<string, unknown>): boolean =>
        evaluateVisibility(visibility, resolverFor(data))

    describe('equality with numeric normalization', () => {
        it('matches equal values', () => {
            expect(check({ field: 'a', operator: '=', value: 'x' }, { a: 'x' })).toBe(true)
        })

        it('normalizes number/string for equality', () => {
            expect(check({ field: 'a', operator: '=', value: 5 }, { a: '5' })).toBe(true)
            expect(check({ field: 'a', operator: '=', value: '5' }, { a: 5 })).toBe(true)
        })

        it('handles != inverse', () => {
            expect(check({ field: 'a', operator: '!=', value: 5 }, { a: '6' })).toBe(true)
            expect(check({ field: 'a', operator: '!=', value: 5 }, { a: '5' })).toBe(false)
        })
    })

    describe('numeric comparisons', () => {
        it('compares numbers coerced from strings', () => {
            expect(check({ field: 'a', operator: '>', value: '3' }, { a: '4' })).toBe(true)
            expect(check({ field: 'a', operator: '>=', value: 4 }, { a: 4 })).toBe(true)
            expect(check({ field: 'a', operator: '<', value: 4 }, { a: 3 })).toBe(true)
            expect(check({ field: 'a', operator: '<=', value: 4 }, { a: 4 })).toBe(true)
        })

        it('returns false when a side is not numeric', () => {
            expect(check({ field: 'a', operator: '>', value: 3 }, { a: 'x' })).toBe(false)
            expect(check({ field: 'a', operator: '>', value: 'x' }, { a: 3 })).toBe(false)
        })
    })

    describe('in / not_in', () => {
        it('checks membership with normalization', () => {
            expect(check({ field: 'a', operator: 'in', value: [1, 2, 3] }, { a: '2' })).toBe(true)
            expect(check({ field: 'a', operator: 'not_in', value: [1, 2, 3] }, { a: '4' })).toBe(true)
        })

        it('returns false when expected is not an array', () => {
            expect(check({ field: 'a', operator: 'in', value: 'nope' }, { a: 'n' })).toBe(false)
        })
    })

    describe('contains', () => {
        it('checks array membership', () => {
            expect(check({ field: 'a', operator: 'contains', value: 2 }, { a: [1, '2', 3] })).toBe(true)
        })

        it('checks substring for strings', () => {
            expect(check({ field: 'a', operator: 'contains', value: 'ell' }, { a: 'hello' })).toBe(true)
            expect(check({ field: 'a', operator: 'contains', value: null }, { a: 'hello' })).toBe(false)
        })

        it('returns false for other types', () => {
            expect(check({ field: 'a', operator: 'contains', value: 1 }, { a: 1 })).toBe(false)
        })
    })

    describe('empty / not_empty', () => {
        it('detects empty values', () => {
            expect(check({ field: 'a', operator: 'empty' }, { a: '' })).toBe(true)
            expect(check({ field: 'a', operator: 'empty' }, { a: null })).toBe(true)
            expect(check({ field: 'a', operator: 'empty' }, { a: [] })).toBe(true)
            expect(check({ field: 'a', operator: 'empty' }, {})).toBe(true)
        })

        it('detects non-empty values', () => {
            expect(check({ field: 'a', operator: 'not_empty' }, { a: 'x' })).toBe(true)
            expect(check({ field: 'a', operator: 'not_empty' }, { a: [0] })).toBe(true)
            expect(check({ field: 'a', operator: 'empty' }, { a: 0 })).toBe(false)
        })
    })

    describe('truthy / falsy', () => {
        it('treats empty as falsy', () => {
            expect(check({ field: 'a', operator: 'truthy' }, { a: '' })).toBe(false)
            expect(check({ field: 'a', operator: 'falsy' }, { a: '' })).toBe(true)
        })

        it('uses Boolean for non-empty', () => {
            expect(check({ field: 'a', operator: 'truthy' }, { a: 'x' })).toBe(true)
            expect(check({ field: 'a', operator: 'truthy' }, { a: 0 })).toBe(false)
            expect(check({ field: 'a', operator: 'falsy' }, { a: 0 })).toBe(true)
        })
    })

    describe('nested groups', () => {
        it('evaluates and', () => {
            const v: Visibility = {
                operator: 'and',
                conditions: [
                    { field: 'a', operator: '=', value: 1 },
                    { field: 'b', operator: '=', value: 2 },
                ],
            }
            expect(check(v, { a: 1, b: 2 })).toBe(true)
            expect(check(v, { a: 1, b: 3 })).toBe(false)
        })

        it('evaluates or', () => {
            const v: Visibility = {
                operator: 'or',
                conditions: [
                    { field: 'a', operator: '=', value: 1 },
                    { field: 'b', operator: '=', value: 2 },
                ],
            }
            expect(check(v, { a: 9, b: 2 })).toBe(true)
            expect(check(v, { a: 9, b: 9 })).toBe(false)
        })

        it('evaluates not', () => {
            const v: Visibility = {
                operator: 'not',
                conditions: [{ field: 'a', operator: '=', value: 1 }],
            }
            expect(check(v, { a: 2 })).toBe(true)
            expect(check(v, { a: 1 })).toBe(false)
        })

        it('nests groups', () => {
            const v: Visibility = {
                operator: 'and',
                conditions: [
                    { field: 'a', operator: '=', value: 1 },
                    {
                        operator: 'or',
                        conditions: [
                            { field: 'b', operator: '=', value: 2 },
                            { field: 'c', operator: '=', value: 3 },
                        ],
                    },
                ],
            }
            expect(check(v, { a: 1, b: 9, c: 3 })).toBe(true)
            expect(check(v, { a: 1, b: 9, c: 9 })).toBe(false)
        })
    })

    it('resolves root references via the resolver', () => {
        const data = { local: 'x' }
        const root = { flag: true }
        const v: Visibility = { field: '$.flag', operator: 'truthy' }
        expect(evaluateVisibility(v, resolverFor(data, root))).toBe(true)
    })
})
