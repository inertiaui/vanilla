import { except, isStandardDomEvent, kebabCase, only } from '../src/helpers'

describe('kebabCase', () => {
    it.each([
        ['XMLHttpRequest', 'xml-http-request'],
        ['getHTTPResponseCode', 'get-http-response-code'],
        ['ABCDefGHij', 'abc-def-g-hij'],
        ['AAaAAa', 'a-aa-a-aa'],
        ['URL42Value', 'url42-value'],
        ['already--kebab_case Name', 'already-kebab-case-name'],
        ['überHTTPServer', 'über-http-server'],
        ['', ''],
    ])('preserves acronym and word boundaries in %s', (input, expected) => {
        expect(kebabCase(input)).toBe(expected)
    })

    it('handles long uppercase runs with or without a following word', () => {
        const acronym = 'A'.repeat(10000)
        expect(kebabCase(acronym)).toBe('a'.repeat(10000))
        expect(kebabCase(acronym + 'Value')).toBe('a'.repeat(10000) + '-value')
        expect(kebabCase(acronym + '42')).toBe('a'.repeat(10000) + '42')
    })
})

describe.each([only, except])('%s filtering', (filter) => {
    const include = filter === only

    it('preserves array order and duplicates, including case-insensitive matching', () => {
        const input = ['Name', 'email', 'NAME', 'Name', 'other']
        const keys = ['name', 'name', 'missing']
        expect(filter(input, keys)).toEqual(include ? [] : input)
        expect(filter(input, keys, true)).toEqual(include ? ['Name', 'NAME', 'Name'] : ['email', 'other'])
        expect(keys).toEqual(['name', 'name', 'missing'])
        expect(input).toEqual(['Name', 'email', 'NAME', 'Name', 'other'])
    })

    it('preserves original object keys, references and undefined values', () => {
        const value = { nested: true }
        const input = { Name: value, NAME: undefined, email: null }
        const result = filter(input, ['name', 'missing'], true)
        expect(result).toEqual(include ? { Name: value, NAME: undefined } : { email: null })
        if (include) expect(result.Name).toBe(value)
        expect(Object.keys(result)).toEqual(include ? ['Name', 'NAME'] : ['email'])
    })

    it('handles empty inputs and key lists', () => {
        expect(filter([], ['name'])).toEqual([])
        expect(filter({}, ['name'])).toEqual({})
        expect(filter(['name'], [])).toEqual(include ? [] : ['name'])
        expect(filter({ name: 1 }, [])).toEqual(include ? {} : { name: 1 })
    })

    it('copies only own enumerable string keys', () => {
        const input = Object.assign(Object.create({ inherited: 1 }), { Name: 2, other: 3 })
        Object.defineProperty(input, 'hidden', { value: 4 })
        input[Symbol('name')] = 5

        const result = filter(input, ['name', 'inherited', 'hidden'], true)
        expect(result).toEqual(include ? { Name: 2 } : { other: 3 })
        expect(Reflect.ownKeys(result)).toEqual(include ? ['Name'] : ['other'])
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    })

    it('returns fresh shallow copies when every entry is retained', () => {
        const value = { nested: true }
        const input = { Name: value }
        const array = ['Name', 'Name']
        const keys = include ? ['name'] : []
        const result = filter(input, keys, true)
        const arrayResult = filter(array, keys, true)

        expect(result).toEqual(input)
        expect(result).not.toBe(input)
        expect(result.Name).toBe(value)
        expect(arrayResult).toEqual(array)
        expect(arrayResult).not.toBe(array)
    })

    it('does not rescan the key list for every input property', () => {
        let keyReads = 0
        const keys = new Proxy(
            Array.from({ length: 500 }, (_, index) => `key${index}`),
            {
                get(target, property, receiver) {
                    if (typeof property === 'string' && /^\d+$/.test(property)) keyReads++
                    return Reflect.get(target, property, receiver)
                },
            },
        )
        const input = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`key${index}`, index]))
        expect(Object.keys(filter(input, keys))).toHaveLength(500)
        expect(keyReads).toBeLessThanOrEqual(keys.length)
    })
})

describe('isStandardDomEvent', () => {
    it('recognizes the existing event families regardless of case', () => {
        const names = [
            'click',
            'dblclick',
            'mousedown',
            'mouseup',
            'mouseover',
            'mouseout',
            'mousemove',
            'mouseenter',
            'mouseleave',
            'keydown',
            'keyup',
            'keypress',
            'focus',
            'blur',
            'change',
            'input',
            'submit',
            'reset',
            'load',
            'unload',
            'error',
            'resize',
            'scroll',
            'touchstart',
            'touchend',
            'touchmove',
            'touchcancel',
            'pointerdown',
            'pointerup',
            'pointermove',
            'pointerenter',
            'pointerleave',
            'pointercancel',
            'drag',
            'dragstart',
            'dragend',
            'dragenter',
            'dragleave',
            'dragover',
            'drop',
            'animationstart',
            'animationend',
            'animationiteration',
            'transitionstart',
            'transitionend',
            'transitionrun',
            'transitioncancel',
        ]
        for (const name of names) {
            expect(isStandardDomEvent(`on${name}`)).toBe(true)
            expect(isStandardDomEvent(`ON${name.toUpperCase()}`)).toBe(true)
            expect(isStandardDomEvent(name)).toBe(false)
            expect(isStandardDomEvent(`on${name}Capture`)).toBe(false)
        }
    })

    it('rejects custom listeners, other props and partially matching names', () => {
        for (const name of [
            '',
            'on',
            'class',
            'aria-label',
            'onUpdate:modelValue',
            'onCustomEvent',
            'onPointer',
            'onDragStartExtra',
            'beforeonclick',
            'onfocusin',
            'onclick\n',
            'onclick\r\n',
            ' onclick',
            'onclick ',
        ]) {
            expect(isStandardDomEvent(name)).toBe(false)
        }
    })

    it('does not retain matching state between calls', () => {
        for (let index = 0; index < 20; index++) {
            expect(isStandardDomEvent('onClick')).toBe(true)
            expect(isStandardDomEvent('onUnknown')).toBe(false)
            expect(isStandardDomEvent('onTransitionCancel')).toBe(true)
        }
    })
})
