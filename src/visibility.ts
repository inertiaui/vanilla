export type VisibilityComparisonOperator =
    | '='
    | '!='
    | '>'
    | '>='
    | '<'
    | '<='
    | 'in'
    | 'not_in'
    | 'contains'
    | 'empty'
    | 'not_empty'
    | 'truthy'
    | 'falsy'
export type VisibilityGroupOperator = 'and' | 'or' | 'not'

export interface VisibilityMetadata {
    dependsOn?: string[]
}

export interface VisibilityLeaf extends VisibilityMetadata {
    field: string
    operator: VisibilityComparisonOperator
    value?: unknown
}

export interface VisibilityGroup extends VisibilityMetadata {
    operator: VisibilityGroupOperator
    conditions: VisibilityCondition[]
}

export type VisibilityCondition = VisibilityLeaf | VisibilityGroup
export type Visibility = VisibilityCondition
export type VisibilityResolver = (path: string) => unknown

export function resolveVisibilityPath(
    path: string,
    data: Record<string, unknown>,
    rootData: Record<string, unknown> = data,
): unknown {
    if (path === '$') {
        return rootData
    }

    if (path.startsWith('$.')) {
        return getByPath(rootData, path.slice(2))
    }

    return getByPath(data, path)
}

export function getByPath(source: unknown, path: string): unknown {
    if (!path) {
        return source
    }

    if (source && typeof source === 'object' && path in source) {
        return (source as Record<string, unknown>)[path]
    }

    return path.split('.').reduce<unknown>((current, segment) => {
        if (current === null || current === undefined || segment === '') {
            return undefined
        }

        if (Array.isArray(current)) {
            const index = Number(segment)

            return Number.isInteger(index) ? current[index] : undefined
        }

        if (typeof current === 'object') {
            return (current as Record<string, unknown>)[segment]
        }

        return undefined
    }, source)
}

export function evaluateVisibility(visibility: Visibility | null | undefined, resolve: VisibilityResolver): boolean {
    if (!visibility) {
        return true
    }

    if (isVisibilityGroup(visibility)) {
        return evaluateGroup(visibility, resolve)
    }

    return evaluateLeaf(visibility, resolve)
}

function isVisibilityGroup(condition: VisibilityCondition): condition is VisibilityGroup {
    return 'conditions' in condition
}

function evaluateGroup(group: VisibilityGroup, resolve: VisibilityResolver): boolean {
    switch (group.operator) {
        case 'and':
            return group.conditions.every((condition) => evaluateVisibility(condition, resolve))
        case 'or':
            return group.conditions.some((condition) => evaluateVisibility(condition, resolve))
        case 'not':
            return !group.conditions.some((condition) => evaluateVisibility(condition, resolve))
        default:
            return false
    }
}

function evaluateLeaf(condition: VisibilityLeaf, resolve: VisibilityResolver): boolean {
    const actual = resolve(condition.field)

    switch (condition.operator) {
        case '=':
            return valuesMatch(actual, condition.value)
        case '!=':
            return !valuesMatch(actual, condition.value)
        case '>':
            return compareNumbers(
                actual,
                condition.value,
                (actualNumber, expectedNumber) => actualNumber > expectedNumber,
            )
        case '>=':
            return compareNumbers(
                actual,
                condition.value,
                (actualNumber, expectedNumber) => actualNumber >= expectedNumber,
            )
        case '<':
            return compareNumbers(
                actual,
                condition.value,
                (actualNumber, expectedNumber) => actualNumber < expectedNumber,
            )
        case '<=':
            return compareNumbers(
                actual,
                condition.value,
                (actualNumber, expectedNumber) => actualNumber <= expectedNumber,
            )
        case 'in':
            return isIn(actual, condition.value)
        case 'not_in':
            return !isIn(actual, condition.value)
        case 'contains':
            return containsValue(actual, condition.value)
        case 'empty':
            return isEmptyValue(actual)
        case 'not_empty':
            return !isEmptyValue(actual)
        case 'truthy':
            return isTruthyValue(actual)
        case 'falsy':
            return !isTruthyValue(actual)
        default:
            return false
    }
}

function valuesMatch(actual: unknown, expected: unknown): boolean {
    if (Object.is(actual, expected)) {
        return true
    }

    const normalizedActual = normalizeComparable(actual)
    const normalizedExpected = normalizeComparable(expected)

    return Object.is(normalizedActual, normalizedExpected)
}

function normalizeComparable(value: unknown): unknown {
    const number = toFiniteNumber(value)

    if (number !== null) {
        return number
    }

    return value
}

function compareNumbers(
    actual: unknown,
    expected: unknown,
    compare: (actualNumber: number, expectedNumber: number) => boolean,
): boolean {
    const actualNumber = toFiniteNumber(actual)
    const expectedNumber = toFiniteNumber(expected)

    if (actualNumber === null || expectedNumber === null) {
        return false
    }

    return compare(actualNumber, expectedNumber)
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
    }

    if (typeof value !== 'string' || value.trim() === '') {
        return null
    }

    const number = Number(value)

    return Number.isFinite(number) ? number : null
}

function isIn(actual: unknown, expected: unknown): boolean {
    if (!Array.isArray(expected)) {
        return false
    }

    return expected.some((candidate) => valuesMatch(actual, candidate))
}

function containsValue(actual: unknown, expected: unknown): boolean {
    if (Array.isArray(actual)) {
        return actual.some((item) => valuesMatch(item, expected))
    }

    if (typeof actual === 'string') {
        if (expected === null || expected === undefined) {
            return false
        }

        return actual.includes(String(expected))
    }

    return false
}

function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
        return true
    }

    if (Array.isArray(value)) {
        return value.length === 0
    }

    return false
}

function isTruthyValue(value: unknown): boolean {
    if (isEmptyValue(value)) {
        return false
    }

    return Boolean(value)
}
