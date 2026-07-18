function rect(left: number, top: number, right: number, bottom: number): DOMRect {
    return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }
}

describe('positionTopLayerPopover', () => {
    afterEach(() => {
        document.body.innerHTML = ''
        vi.resetModules()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('falls back to manual positioning when CSS anchor sizing still overflows the viewport', async () => {
        vi.stubGlobal('CSS', {
            supports: vi.fn(() => true),
        })

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })

        const { positionTopLayerPopover } = await import('../src/position')
        const reference = document.createElement('button')
        const popover = document.createElement('div')

        reference.getBoundingClientRect = () => rect(32, 430, 252, 470)
        Object.defineProperty(popover, 'scrollWidth', { configurable: true, value: 332 })
        Object.defineProperty(popover, 'scrollHeight', { configurable: true, value: 480 })
        popover.getBoundingClientRect = () => {
            const hasAnchorClass = Array.from(popover.classList).some((className) =>
                className.startsWith('iui-anchor-'),
            )

            if (hasAnchorClass) {
                return rect(32, -42, 364, 438)
            }

            const height = popover.style.maxHeight.endsWith('px') ? Number.parseFloat(popover.style.maxHeight) : 480

            return rect(0, 0, 332, height)
        }

        document.body.append(reference, popover)

        const result = positionTopLayerPopover(reference, popover, {
            placement: 'bottom-start',
            offset: 4,
            flip: true,
            viewportMargin: 8,
        })

        expect(result.placement).toBe('top-start')
        expect(result.y).toBe(8)
        expect(popover.style.top).toBe('8px')
        expect(popover.style.left).toBe('32px')
        expect(popover.style.maxHeight).toBe('418px')
        expect(reference.style.getPropertyValue('anchor-name')).toBe('')
        expect(popover.style.getPropertyValue('position-anchor')).toBe('')
        expect(Array.from(popover.classList).some((className) => className.startsWith('iui-anchor-'))).toBe(false)
    })
})
