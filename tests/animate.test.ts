import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { easings, animate, cancelAnimations } from '../src/animate'

describe('animate', () => {
    describe('easings', () => {
        it('should have linear easing', () => {
            expect(easings.linear).toBe('linear')
        })

        it('should have in easing', () => {
            expect(easings.in).toBe('cubic-bezier(0.4, 0, 1, 1)')
        })

        it('should have out easing', () => {
            expect(easings.out).toBe('cubic-bezier(0, 0, 0.2, 1)')
        })

        it('should have inOut easing', () => {
            expect(easings.inOut).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
        })
    })

    describe('animate', () => {
        let element: HTMLDivElement
        let mockAnimation: { finished: Promise<Animation>; cancel: ReturnType<typeof vi.fn> }

        beforeEach(() => {
            element = document.createElement('div')
            document.body.appendChild(element)

            mockAnimation = {
                finished: Promise.resolve({} as Animation),
                cancel: vi.fn(),
            }

            element.animate = vi.fn().mockReturnValue(mockAnimation)
        })

        afterEach(() => {
            document.body.removeChild(element)
        })

        it('should call element.animate with keyframes and default options', async () => {
            const keyframes = [{ opacity: 0 }, { opacity: 1 }]
            await animate(element, keyframes)

            expect(element.animate).toHaveBeenCalledWith(keyframes, {
                duration: 300,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards',
            })
        })

        it('should use custom duration', async () => {
            const keyframes = [{ opacity: 0 }, { opacity: 1 }]
            await animate(element, keyframes, { duration: 500 })

            expect(element.animate).toHaveBeenCalledWith(keyframes, {
                duration: 500,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards',
            })
        })

        it('should resolve easing name to cubic-bezier', async () => {
            const keyframes = [{ opacity: 0 }, { opacity: 1 }]
            await animate(element, keyframes, { easing: 'out' })

            expect(element.animate).toHaveBeenCalledWith(keyframes, {
                duration: 300,
                easing: 'cubic-bezier(0, 0, 0.2, 1)',
                fill: 'forwards',
            })
        })

        it('should pass through custom easing string', async () => {
            const keyframes = [{ opacity: 0 }, { opacity: 1 }]
            await animate(element, keyframes, { easing: 'ease-in-out' })

            expect(element.animate).toHaveBeenCalledWith(keyframes, {
                duration: 300,
                easing: 'ease-in-out',
                fill: 'forwards',
            })
        })

        it('should use custom fill mode', async () => {
            const keyframes = [{ opacity: 0 }, { opacity: 1 }]
            await animate(element, keyframes, { fill: 'none' })

            expect(element.animate).toHaveBeenCalledWith(keyframes, {
                duration: 300,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'none',
            })
        })

        it('should return the finished promise', async () => {
            const keyframes = [{ opacity: 0 }, { opacity: 1 }]
            const result = animate(element, keyframes)
            await expect(result).resolves.toBeDefined()
        })
    })

    describe('cancelAnimations', () => {
        it('should cancel all animations on an element', () => {
            const element = document.createElement('div')
            const cancelFn1 = vi.fn()
            const cancelFn2 = vi.fn()

            element.getAnimations = vi.fn().mockReturnValue([
                { cancel: cancelFn1 },
                { cancel: cancelFn2 },
            ])

            cancelAnimations(element)

            expect(cancelFn1).toHaveBeenCalled()
            expect(cancelFn2).toHaveBeenCalled()
        })

        it('should handle no animations', () => {
            const element = document.createElement('div')
            element.getAnimations = vi.fn().mockReturnValue([])

            cancelAnimations(element)
            // Should not throw
        })
    })
})
