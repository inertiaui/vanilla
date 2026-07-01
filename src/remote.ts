/**
 * Framework-agnostic helpers for debounced, abortable remote requests.
 *
 * These are the generic mechanics behind typeahead/async-search controls:
 * a debounced scheduler, stale-request aborting, sequence guarding, a JSON
 * fetch helper, and a query-string builder. They hold no opinion about
 * response shapes, selection state, or caching; that stays with the caller.
 */

/**
 * A debounced scheduler. Each `schedule()` cancels any pending call and
 * queues a fresh one `delay` milliseconds out.
 */
export interface Debouncer {
    /** Queue `fn` to run after `delay` ms, cancelling any pending call. */
    schedule(fn: () => void): void
    /** Cancel a pending call, if any. */
    cancel(): void
}

/**
 * Create a {@link Debouncer} with a fixed delay.
 *
 * @param delay - Milliseconds to wait after the latest `schedule()` call.
 */
export function createDebouncer(delay: number): Debouncer {
    let timer: ReturnType<typeof setTimeout> | null = null

    const cancel = () => {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
    }

    const schedule = (fn: () => void) => {
        cancel()
        timer = setTimeout(() => {
            timer = null
            fn()
        }, delay)
    }

    return { schedule, cancel }
}

/** Outcome of a task run through a {@link RequestRunner}. */
export type RequestResult<T> =
    /** Task resolved and is still the latest request. */
    | { status: 'ok'; data: T }
    /** A newer request superseded this one; ignore the result. */
    | { status: 'stale' }
    /** The request was aborted (superseded or via {@link RequestRunner.abort}). */
    | { status: 'aborted' }
    /** Task rejected for a non-abort reason. */
    | { status: 'error'; error: unknown }

/**
 * Serialises overlapping async requests. Each `run()` aborts the previous
 * in-flight request and tags itself with a sequence number, so a late
 * response from a superseded request resolves as `stale` instead of
 * clobbering fresher data.
 */
export interface RequestRunner {
    /**
     * Abort the previous request (if any) and run `task` with a fresh
     * {@link AbortSignal}. Resolves with the outcome; never rejects.
     */
    run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<RequestResult<T>>
    /** Abort the in-flight request, if any. */
    abort(): void
    /** Whether a request started by this runner is still the latest one. */
    readonly pending: boolean
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException
        ? error.name === 'AbortError'
        : (error as { name?: string })?.name === 'AbortError'
}

/**
 * Create a {@link RequestRunner}.
 *
 * The runner combines two guards: it aborts the prior request's signal and
 * it compares sequence numbers, so results from non-abortable tasks (or races
 * where a response lands after a newer request starts) are still reported as
 * `stale` rather than applied.
 */
export function createRequestRunner(): RequestRunner {
    let controller: AbortController | null = null
    let sequence = 0
    let latest = 0

    const abort = () => {
        controller?.abort()
        controller = null
    }

    const run = async <T>(task: (signal: AbortSignal) => Promise<T>): Promise<RequestResult<T>> => {
        controller?.abort()
        controller = new AbortController()

        const seq = ++sequence
        latest = seq

        try {
            const data = await task(controller.signal)
            if (seq !== latest) {
                return { status: 'stale' }
            }
            return { status: 'ok', data }
        } catch (error) {
            if (seq !== latest) {
                return { status: 'stale' }
            }
            if (isAbortError(error)) {
                return { status: 'aborted' }
            }
            return { status: 'error', error }
        } finally {
            if (seq === latest) {
                controller = null
            }
        }
    }

    return {
        run,
        abort,
        get pending() {
            return sequence === latest && sequence > 0 && controller !== null
        },
    }
}

/** Error thrown by {@link fetchJson} when the response status is not ok. */
export class HttpError extends Error {
    readonly status: number
    readonly response: Response

    constructor(response: Response) {
        super(`Request failed with status ${response.status}`)
        this.name = 'HttpError'
        this.status = response.status
        this.response = response
    }
}

/** Options for {@link fetchJson}. Extends `RequestInit`; `headers` merges over the defaults. */
export interface FetchJsonOptions extends Omit<RequestInit, 'headers'> {
    headers?: Record<string, string>
}

/**
 * Fetch a URL and parse the JSON body.
 *
 * Sends `Accept: application/json` and `X-Requested-With: XMLHttpRequest` by
 * default (override or extend via `options.headers`). Throws {@link HttpError}
 * on a non-ok status.
 */
export async function fetchJson<T = unknown>(url: string, options: FetchJsonOptions = {}): Promise<T> {
    const { headers, ...rest } = options

    const response = await fetch(url, {
        ...rest,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...headers,
        },
    })

    if (!response.ok) {
        throw new HttpError(response)
    }

    return response.json() as Promise<T>
}

/** A value assignable to a query parameter. Arrays append repeated keys. */
export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number | boolean>

/**
 * Build an absolute URL from a base and a bag of query parameters.
 *
 * Scalars are set, arrays append the key once per item, and `null`/`undefined`
 * values are skipped. A relative `base` resolves against `origin` (defaulting
 * to `window.location.origin` in the browser).
 *
 * @param base - Absolute or relative URL.
 * @param params - Query parameters to append.
 * @param origin - Base origin for a relative `base`.
 */
export function buildUrl(base: string, params: Record<string, QueryValue> = {}, origin?: string): string {
    const resolvedOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
    const url = new URL(base, resolvedOrigin)

    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
            continue
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                url.searchParams.append(key, String(item))
            }
        } else {
            url.searchParams.set(key, String(value as string | number | boolean))
        }
    }

    return url.toString()
}
