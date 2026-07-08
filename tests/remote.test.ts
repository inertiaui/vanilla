import { createDebouncer, createRequestRunner } from '../src/remote'

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
})

describe('createRequestRunner', () => {
    it('resolves ok for a lone request', async () => {
        const runner = createRequestRunner()
        const result = await runner.run(async () => 'value')
        expect(result).toEqual({ status: 'ok', data: 'value' })
        expect(runner.pending).toBe(false)
    })

    it('marks the superseded request as stale and keeps the newest data', async () => {
        const runner = createRequestRunner()

        let resolveSlow: (v: string) => void = () => {}
        const slow = new Promise<string>((resolve) => (resolveSlow = resolve))

        const firstPromise = runner.run(() => slow)
        const secondPromise = runner.run(async () => 'fresh')

        const second = await secondPromise
        resolveSlow('stale-data')
        const first = await firstPromise

        expect(second).toEqual({ status: 'ok', data: 'fresh' })
        expect(first).toEqual({ status: 'stale' })
    })

    it('aborts the previous request signal when a new run starts', async () => {
        const runner = createRequestRunner()
        const aborts: boolean[] = []

        const firstPromise = runner.run(
            (signal) =>
                new Promise<string>((_, reject) => {
                    signal.addEventListener('abort', () => {
                        aborts.push(true)
                        reject(new DOMException('aborted', 'AbortError'))
                    })
                }),
        )

        await runner.run(async () => 'fresh')
        const first = await firstPromise

        expect(aborts).toEqual([true])
        // Superseded before the abort rejection is observed, so it is stale.
        expect(first.status).toBe('stale')
    })

    it('reports aborted when abort() is called with no newer request', async () => {
        const runner = createRequestRunner()

        const promise = runner.run(
            (signal) =>
                new Promise<string>((_, reject) => {
                    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
                }),
        )

        runner.abort()
        const result = await promise
        expect(result.status).toBe('aborted')
    })

    it('reports errors from the task', async () => {
        const runner = createRequestRunner()
        const error = new Error('boom')
        const result = await runner.run(async () => {
            throw error
        })
        expect(result).toEqual({ status: 'error', error })
    })
})
