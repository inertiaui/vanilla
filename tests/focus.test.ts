import { focusFirstEnabledElement } from '../src/focus'

describe('focusFirstEnabledElement', () => {
    it('focuses the first enabled element', () => {
        const first = document.createElement('input')
        const second = document.createElement('button')

        document.body.append(first, second)

        expect(focusFirstEnabledElement([first, second])).toBe(true)
        expect(document.activeElement).toBe(first)

        first.remove()
        second.remove()
    })

    it('skips disabled buttons', () => {
        const disabled = document.createElement('button')
        const enabled = document.createElement('button')

        disabled.disabled = true
        document.body.append(disabled, enabled)

        expect(focusFirstEnabledElement([disabled, enabled])).toBe(true)
        expect(document.activeElement).toBe(enabled)

        disabled.remove()
        enabled.remove()
    })

    it('skips disabled form controls', () => {
        const disabled = document.createElement('input')
        const enabled = document.createElement('input')

        disabled.disabled = true
        document.body.append(disabled, enabled)

        expect(focusFirstEnabledElement([disabled, enabled])).toBe(true)
        expect(document.activeElement).toBe(enabled)

        disabled.remove()
        enabled.remove()
    })

    it('returns false when no control can be focused', () => {
        const disabled = document.createElement('button')
        disabled.disabled = true
        document.body.append(disabled)

        expect(focusFirstEnabledElement([null, undefined, disabled])).toBe(false)

        disabled.remove()
    })
})
