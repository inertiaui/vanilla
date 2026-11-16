import { createAnnouncer } from '../src/announcer'

describe('createAnnouncer', () => {
    let polite: HTMLElement
    let assertive: HTMLElement

    beforeEach(() => {
        vi.useFakeTimers()
        polite = document.createElement('div')
        assertive = document.createElement('div')
    })

    afterEach(() => vi.useRealTimers())

    it('waits until the regions have existed for 150ms before writing', () => {
        const announcer = createAnnouncer({ polite, assertive })
        announcer.announce('Saved', 'polite')

        vi.advanceTimersByTime(149)
        expect(polite.textContent).toBe('')

        vi.advanceTimersByTime(1)
        expect(polite.textContent).toBe('Saved')
    })

    it('joins messages that arrive together and keeps each politeness in its own region', () => {
        const announcer = createAnnouncer({ polite, assertive })
        vi.advanceTimersByTime(500)

        announcer.announce('Saved.', 'polite')
        vi.advanceTimersByTime(20)
        announcer.announce('Sent.', 'polite')
        announcer.announce('Failed.', 'assertive')

        vi.advanceTimersByTime(29)
        expect(polite.textContent).toBe('')

        vi.advanceTimersByTime(1)
        expect(polite.textContent).toBe('Saved. Sent.')
        expect(assertive.textContent).toBe('Failed.')
    })

    it('clears a region one second after its last write', () => {
        const announcer = createAnnouncer({ polite, assertive })
        announcer.announce('Saved', 'polite')
        vi.advanceTimersByTime(150)

        vi.advanceTimersByTime(999)
        expect(polite.textContent).toBe('Saved')

        vi.advanceTimersByTime(1)
        expect(polite.textContent).toBe('')
    })

    it('empties the region before writing again, so the same message is announced twice', () => {
        const announcer = createAnnouncer({ polite, assertive })
        announcer.announce('Saved', 'polite')
        vi.advanceTimersByTime(150)

        announcer.announce('Saved', 'polite')
        vi.advanceTimersByTime(50)
        expect(polite.textContent).toBe('')

        vi.advanceTimersByTime(50)
        expect(polite.textContent).toBe('Saved')

        vi.advanceTimersByTime(999)
        expect(polite.textContent).toBe('Saved')
        vi.advanceTimersByTime(1)
        expect(polite.textContent).toBe('')
    })

    it('writes nothing after it is destroyed', () => {
        const announcer = createAnnouncer({ polite, assertive })
        announcer.announce('Saved', 'polite')
        announcer.destroy()

        vi.advanceTimersByTime(5000)
        expect(polite.textContent).toBe('')
    })

    it.each([0, 50, 100])('stays destroyed with pending work %ims after a repeated announcement', (delay) => {
        const announcer = createAnnouncer({ polite, assertive })
        announcer.announce('Saved', 'polite')
        announcer.announce('Failed', 'assertive')
        vi.advanceTimersByTime(150)

        announcer.announce('Saved', 'polite')
        announcer.announce('Failed', 'assertive')
        vi.advanceTimersByTime(delay)
        const beforeDestroy = [polite.textContent, assertive.textContent]

        announcer.destroy()
        announcer.destroy()
        announcer.announce('Late update', 'polite')
        announcer.announce('Late error', 'assertive')

        expect(vi.getTimerCount()).toBe(0)
        vi.advanceTimersByTime(5000)
        expect([polite.textContent, assertive.textContent]).toEqual(beforeDestroy)
    })

    it('ignores announcements when destroyed before its first use', () => {
        const announcer = createAnnouncer({ polite, assertive })
        announcer.destroy()
        announcer.announce('Saved', 'polite')
        announcer.announce('Failed', 'assertive')

        expect(vi.getTimerCount()).toBe(0)
        vi.advanceTimersByTime(5000)
        expect(polite.textContent).toBe('')
        expect(assertive.textContent).toBe('')
        expect(vi.getTimerCount()).toBe(0)
    })
})
