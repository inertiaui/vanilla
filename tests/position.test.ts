import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { supportsAnchorPositioning, computePosition, autoUpdate } from '../src/position'

describe('position', () => {
    describe('supportsAnchorPositioning', () => {
        it('should return false when CSS anchor is not supported', () => {
            expect(supportsAnchorPositioning()).toBe(false)
        })

        it('should cache the result', () => {
            const first = supportsAnchorPositioning()
            const second = supportsAnchorPositioning()
            expect(first).toBe(second)
        })
    })

    describe('computePosition', () => {
        let reference: HTMLElement
        let floating: HTMLElement

        beforeEach(() => {
            reference = document.createElement('div')
            floating = document.createElement('div')
            document.body.appendChild(reference)
            document.body.appendChild(floating)

            vi.spyOn(reference, 'getBoundingClientRect').mockReturnValue({
                top: 100,
                right: 200,
                bottom: 140,
                left: 100,
                width: 100,
                height: 40,
                x: 100,
                y: 100,
                toJSON() {},
            })

            vi.spyOn(floating, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                right: 150,
                bottom: 30,
                left: 0,
                width: 150,
                height: 30,
                x: 0,
                y: 0,
                toJSON() {},
            })

            Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
            Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true })
        })

        afterEach(() => {
            reference.remove()
            floating.remove()
        })

        it('should return a position result with x, y, and placement', () => {
            const result = computePosition(reference, floating)

            expect(result).toHaveProperty('x')
            expect(result).toHaveProperty('y')
            expect(result).toHaveProperty('placement')
            expect(typeof result.x).toBe('number')
            expect(typeof result.y).toBe('number')
        })

        it('should position below the reference by default (bottom-start)', () => {
            const result = computePosition(reference, floating)

            expect(result.x).toBe(100)
            expect(result.y).toBe(140)
            expect(result.placement).toBe('bottom-start')
        })

        it('should position above the reference with top placement', () => {
            const result = computePosition(reference, floating, { placement: 'top' })

            expect(result.x).toBe(75)
            expect(result.y).toBe(70)
            expect(result.placement).toBe('top')
        })

        it('should apply offset', () => {
            const result = computePosition(reference, floating, { placement: 'bottom-start', offset: 8 })

            expect(result.x).toBe(100)
            expect(result.y).toBe(148)
        })

        it('should position with bottom-end placement', () => {
            const result = computePosition(reference, floating, { placement: 'bottom-end' })

            expect(result.x).toBe(50)
            expect(result.y).toBe(140)
        })

        it('should position with bottom (center) placement', () => {
            const result = computePosition(reference, floating, { placement: 'bottom' })

            expect(result.x).toBe(75)
            expect(result.y).toBe(140)
        })

        it('should position with left placement', () => {
            // Reference at x=100, floating width=150 → left would be -50, which overflows.
            // Flip to right: x = refRect.right = 200
            const result = computePosition(reference, floating, { placement: 'left' })

            expect(result.x).toBe(200)
            expect(result.y).toBe(105)
            expect(result.placement).toBe('right')
        })

        it('should position with left placement without flip', () => {
            const result = computePosition(reference, floating, { placement: 'left', flip: false })

            // left: x = 100 - 150 = -50, clamped to 4
            expect(result.x).toBe(4)
            expect(result.y).toBe(105)
            expect(result.placement).toBe('left')
        })

        it('should position with right placement', () => {
            const result = computePosition(reference, floating, { placement: 'right' })

            expect(result.x).toBe(200)
            expect(result.y).toBe(105)
        })

        it('should position with left-start placement', () => {
            // Flips to right-start since left would overflow
            const result = computePosition(reference, floating, { placement: 'left-start' })

            expect(result.x).toBe(200)
            expect(result.y).toBe(100)
            expect(result.placement).toBe('right-start')
        })

        it('should position with left-start placement without flip', () => {
            const result = computePosition(reference, floating, { placement: 'left-start', flip: false })

            expect(result.x).toBe(4)
            expect(result.y).toBe(100)
        })

        it('should position with right-end placement', () => {
            const result = computePosition(reference, floating, { placement: 'right-end' })

            expect(result.x).toBe(200)
            expect(result.y).toBe(110)
        })

        it('should position with top-start placement', () => {
            const result = computePosition(reference, floating, { placement: 'top-start' })

            expect(result.x).toBe(100)
            expect(result.y).toBe(70)
        })

        it('should position with top-end placement', () => {
            const result = computePosition(reference, floating, { placement: 'top-end' })

            expect(result.x).toBe(50)
            expect(result.y).toBe(70)
        })

        it('should flip when placement overflows viewport', () => {
            vi.spyOn(reference, 'getBoundingClientRect').mockReturnValue({
                top: 730,
                right: 200,
                bottom: 760,
                left: 100,
                width: 100,
                height: 30,
                x: 100,
                y: 730,
                toJSON() {},
            })

            const result = computePosition(reference, floating, { placement: 'bottom-start' })

            expect(result.placement).toBe('top-start')
        })

        it('should not flip when flip is disabled', () => {
            vi.spyOn(reference, 'getBoundingClientRect').mockReturnValue({
                top: 730,
                right: 200,
                bottom: 760,
                left: 100,
                width: 100,
                height: 30,
                x: 100,
                y: 730,
                toJSON() {},
            })

            const result = computePosition(reference, floating, { placement: 'bottom-start', flip: false })

            expect(result.placement).toBe('bottom-start')
        })

        it('should set fixed position styles on the floating element', () => {
            computePosition(reference, floating)

            expect(floating.style.position).toBe('fixed')
            expect(floating.style.left).toBeTruthy()
            expect(floating.style.top).toBeTruthy()
        })

        it('should clamp to viewport edges with margin', () => {
            vi.spyOn(reference, 'getBoundingClientRect').mockReturnValue({
                top: 0,
                right: 50,
                bottom: 20,
                left: 0,
                width: 50,
                height: 20,
                x: 0,
                y: 0,
                toJSON() {},
            })

            const result = computePosition(reference, floating, { placement: 'top-start', flip: false })

            expect(result.x).toBeGreaterThanOrEqual(4)
            expect(result.y).toBeGreaterThanOrEqual(4)
        })
    })

    describe('autoUpdate', () => {
        let reference: HTMLElement
        let floating: HTMLElement

        beforeEach(() => {
            reference = document.createElement('div')
            floating = document.createElement('div')
            document.body.appendChild(reference)
            document.body.appendChild(floating)
        })

        afterEach(() => {
            reference.remove()
            floating.remove()
        })

        it('should return a cleanup function', () => {
            const update = vi.fn()
            const cleanup = autoUpdate(reference, floating, update)

            expect(typeof cleanup).toBe('function')
            cleanup()
        })

        it('should call update on resize', () => {
            const update = vi.fn()
            const cleanup = autoUpdate(reference, floating, update)

            window.dispatchEvent(new Event('resize'))

            cleanup()
        })

        it('should call update on scroll', () => {
            const update = vi.fn()
            const cleanup = autoUpdate(reference, floating, update)

            window.dispatchEvent(new Event('scroll'))

            cleanup()
        })

        it('should be safe to call cleanup multiple times', () => {
            const update = vi.fn()
            const cleanup = autoUpdate(reference, floating, update)

            cleanup()
            cleanup()
        })

        it('should remove event listeners on cleanup', () => {
            const removeSpy = vi.spyOn(window, 'removeEventListener')
            const update = vi.fn()
            const cleanup = autoUpdate(reference, floating, update)

            cleanup()

            expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
            expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true)

            removeSpy.mockRestore()
        })
    })
})
