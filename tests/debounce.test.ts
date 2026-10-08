import { createDebouncer } from '../src/debounce'

describe('createDebouncer', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('runs the function after the delay', () => {
        const fn = vi.fn()
        const d = createDebouncer(200)

        d.schedule(fn)
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(199)
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('cancels the pending call when rescheduled', () => {
        const first = vi.fn()
        const second = vi.fn()
        const d = createDebouncer(100)

        d.schedule(first)
        vi.advanceTimersByTime(50)
        d.schedule(second)
        vi.advanceTimersByTime(100)

        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })

    it('cancel() prevents a pending call', () => {
        const fn = vi.fn()
        const d = createDebouncer(100)

        d.schedule(fn)
        d.cancel()
        vi.advanceTimersByTime(200)

        expect(fn).not.toHaveBeenCalled()
    })
    it('reads the current delay when scheduling and reports pending work', () => {
        let delay = 200
        const d = createDebouncer(() => delay)
        const fn = vi.fn(() => expect(d.pending).toBe(false))
        expect(d.pending).toBe(false)
        d.schedule(fn)
        expect(d.pending).toBe(true)
        vi.advanceTimersByTime(100)
        expect(fn).not.toHaveBeenCalled()
        delay = 50
        d.schedule(fn)
        vi.advanceTimersByTime(49)
        expect(fn).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(fn).toHaveBeenCalledTimes(1)
        d.schedule(fn)
        d.cancel()
        expect(d.pending).toBe(false)
    })
})
