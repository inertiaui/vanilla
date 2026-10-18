import { createDebouncer, debounce, detectFramerate } from '../src/debounce'

describe('animation-frame debounce', () => {
    afterEach(() => vi.restoreAllMocks())

    it('does not cancel already completed frames, including when the callback reschedules itself', () => {
        const frames = new Map<number, FrameRequestCallback>()
        let nextId = 1
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
            const id = nextId++
            frames.set(id, callback)
            return id
        })
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
            frames.delete(id)
        })
        const values: unknown[] = []
        const scheduled = debounce((value: unknown) => {
            values.push(value)
            if (value === 'first') scheduled('second')
        })
        const flush = () => {
            const pending = [...frames.values()]
            frames.clear()
            pending.forEach((callback) => callback(0))
        }
        scheduled('first')
        flush()
        expect(values).toEqual(['first'])
        flush()
        scheduled('third')
        flush()
        expect(values).toEqual(['first', 'second', 'third'])
        expect(cancel).not.toHaveBeenCalled()
    })

    it('keeps latest arguments and callback ordering when the first frame handle is zero', () => {
        const frames = new Map<number, FrameRequestCallback>()
        let nextId = 0
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
            const id = nextId++
            frames.set(id, callback)
            return id
        })
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
            frames.delete(id)
        })
        const values: unknown[] = []
        const scheduled = debounce((...args: unknown[]) => values.push(args))
        scheduled('old')
        requestAnimationFrame(() => values.push('independent'))
        scheduled('latest', 2)
        for (const callback of frames.values()) callback(0)
        expect(values).toEqual(['independent', ['latest', 2]])
    })
})

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

describe('detectFramerate cleanup', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('releases the fallback timer when frame sampling completes', async () => {
        let nextFrame: FrameRequestCallback | undefined
        let frameId = 0
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
            nextFrame = callback
            return ++frameId
        })
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
        const measured = detectFramerate()
        expect(vi.getTimerCount()).toBe(1)
        for (let index = 0; index <= 10; index++) {
            const callback = nextFrame!
            nextFrame = undefined
            callback(index * 20)
        }
        expect(await measured).toBe(50)
        expect(nextFrame).toBeUndefined()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('resolves to 60 and cancels a stalled frame after the timeout', async () => {
        vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(123)
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
        const measured = detectFramerate()
        vi.advanceTimersByTime(1000)
        expect(await measured).toBe(60)
        expect(cancel).toHaveBeenCalledWith(123)
        expect(vi.getTimerCount()).toBe(0)
    })
})
