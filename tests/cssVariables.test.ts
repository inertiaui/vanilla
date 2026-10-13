import { inheritCssVariables } from '../src/cssVariables'

describe('CSS variable inheritance', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('reads every selected computed value before writing to the target', () => {
        const source = document.createElement('div')
        const target = document.createElement('div')
        source.style.cssText = '--theme-a: red; --theme-b: blue; --other: green'
        document.body.append(source, target)
        const computed = window.getComputedStyle(source)
        const read = vi.spyOn(computed, 'getPropertyValue')
        vi.spyOn(window, 'getComputedStyle').mockReturnValue(computed)
        const write = vi.spyOn(target.style, 'setProperty')

        const cleanup = inheritCssVariables(source, target, { filter: (name) => name.startsWith('--theme-') })
        try {
            expect(target.style.getPropertyValue('--theme-a')).toBe('red')
            expect(target.style.getPropertyValue('--theme-b')).toBe('blue')
            expect(target.style.getPropertyValue('--other')).toBe('')
            expect(read).toHaveBeenCalledTimes(2)
            expect(Math.max(...read.mock.invocationCallOrder)).toBeLessThan(write.mock.invocationCallOrder[0])
        } finally {
            cleanup()
        }
    })

    it('tracks additions, changes and removals, and restores original priorities', async () => {
        const source = document.createElement('div')
        const target = document.createElement('div')
        source.style.cssText = '--theme-a: red; --theme-b: blue'
        target.style.setProperty('--theme-a', 'original', 'important')
        document.body.append(source, target)
        const cleanup = inheritCssVariables(source, target, { filter: (name) => name.startsWith('--theme-') })
        try {
            source.style.setProperty('--theme-a', 'green')
            source.style.removeProperty('--theme-b')
            source.style.setProperty('--theme-c', 'purple')
            await vi.waitFor(() => {
                expect(target.style.getPropertyValue('--theme-a')).toBe('green')
                expect(target.style.getPropertyValue('--theme-b')).toBe('')
                expect(target.style.getPropertyValue('--theme-c')).toBe('purple')
            })
            source.style.removeProperty('--theme-a')
            await vi.waitFor(() => {
                expect(target.style.getPropertyValue('--theme-a')).toBe('original')
                expect(target.style.getPropertyPriority('--theme-a')).toBe('important')
            })
        } finally {
            cleanup()
        }
        expect(target.style.getPropertyValue('--theme-c')).toBe('')
        expect(target.style.getPropertyValue('--theme-a')).toBe('original')
    })

    it('keeps consumer overrides and removes media listeners on cleanup', () => {
        const source = document.createElement('div')
        const target = document.createElement('div')
        source.style.setProperty('--theme-color', 'red')
        document.body.append(source, target)
        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const add = vi.spyOn(media, 'addEventListener')
        const remove = vi.spyOn(media, 'removeEventListener')
        vi.spyOn(window, 'matchMedia').mockReturnValue(media)
        const cleanup = inheritCssVariables(source, target, {
            filter: (name) => name.startsWith('--theme-'),
            mediaQueries: ['(prefers-color-scheme: dark)'],
        })
        source.style.setProperty('--theme-color', 'blue')
        media.dispatchEvent(new Event('change'))
        expect(target.style.getPropertyValue('--theme-color')).toBe('blue')
        target.style.setProperty('--theme-color', 'consumer', 'important')
        cleanup()
        cleanup()
        expect(target.style.getPropertyValue('--theme-color')).toBe('consumer')
        expect(target.style.getPropertyPriority('--theme-color')).toBe('important')
        expect(remove).toHaveBeenCalledWith('change', add.mock.calls[0][1])
    })
})
