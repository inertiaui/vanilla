import { createDebouncer, createRequestRunner, fetchJson, buildUrl, HttpError } from '../src/remote'

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

describe('fetchJson', () => {
    afterEach(() => vi.restoreAllMocks())

    it('sends JSON headers and returns the parsed body', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        const data = await fetchJson<{ ok: boolean }>('https://example.com/api')

        expect(data).toEqual({ ok: true })
        const headers = fetchMock.mock.calls[0][1].headers
        expect(headers.Accept).toBe('application/json')
        expect(headers['X-Requested-With']).toBe('XMLHttpRequest')
    })

    it('merges and overrides headers, forwards other init', async () => {
        const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        const signal = new AbortController().signal
        await fetchJson('https://example.com/api', {
            signal,
            headers: { Accept: 'application/vnd.api+json', 'X-Custom': '1' },
        })

        const init = fetchMock.mock.calls[0][1]
        expect(init.signal).toBe(signal)
        expect(init.headers.Accept).toBe('application/vnd.api+json')
        expect(init.headers['X-Custom']).toBe('1')
        expect(init.headers['X-Requested-With']).toBe('XMLHttpRequest')
    })

    it('throws HttpError on a non-ok status', async () => {
        const fetchMock = vi.fn(async () => new Response('nope', { status: 404 }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchJson('https://example.com/missing')).rejects.toMatchObject({
            name: 'HttpError',
            status: 404,
        })
    })
})

describe('buildUrl', () => {
    it('sets scalar params and skips null/undefined', () => {
        const url = buildUrl('https://example.com/search', {
            q: 'term',
            page: 2,
            active: true,
            empty: null,
            missing: undefined,
        })

        const parsed = new URL(url)
        expect(parsed.searchParams.get('q')).toBe('term')
        expect(parsed.searchParams.get('page')).toBe('2')
        expect(parsed.searchParams.get('active')).toBe('true')
        expect(parsed.searchParams.has('empty')).toBe(false)
        expect(parsed.searchParams.has('missing')).toBe(false)
    })

    it('appends arrays as repeated keys', () => {
        const url = buildUrl('https://example.com/search', { 'ids[]': [1, 2, 3] })
        const parsed = new URL(url)
        expect(parsed.searchParams.getAll('ids[]')).toEqual(['1', '2', '3'])
    })

    it('resolves a relative base against the provided origin', () => {
        const url = buildUrl('/search', { q: 'x' }, 'https://example.test')
        expect(url).toBe('https://example.test/search?q=x')
    })
})
