import { getReorderOffsets, getScrollableAncestors, type ReorderBounds } from '../src/reorder'

const box = (left: number, top: number, right: number, bottom: number): ReorderBounds => ({ left, top, right, bottom })

describe('getReorderOffsets', () => {
    // A vertical list with 10px gaps between items of 20, 40 and 10px.
    const rows = [box(0, 0, 100, 20), box(0, 30, 100, 70), box(0, 80, 100, 90)]

    it('repacks a vertical list from its first slot, keeping the gaps between slots', () => {
        expect(getReorderOffsets(rows, [2, 0, 1])).toEqual([20, 20, -80])
        expect(getReorderOffsets(rows, [1, 0, 2])).toEqual([50, -30, 0])
        expect(getReorderOffsets(rows, [0, 1, 2])).toEqual([0, 0, 0])
    })

    it('uses each gap at its slot, so uneven gaps stay where they were', () => {
        const uneven = [box(0, 0, 100, 20), box(0, 25, 100, 45), box(0, 65, 100, 85)]

        // Items of equal size swap slots exactly, whatever the gaps.
        expect(getReorderOffsets(uneven, [2, 1, 0])).toEqual([65, 0, -65])
    })

    it('measures along x, and from the end when the layout runs in reverse', () => {
        const columns = [box(0, 0, 30, 10), box(30, 0, 100, 10), box(100, 0, 120, 10)]
        expect(getReorderOffsets(columns, [1, 0, 2], { axis: 'x' })).toEqual([70, -30, 0])

        // Right-to-left: item 0 sits on the right, with 10px gaps.
        const reversed = [box(80, 0, 100, 10), box(40, 0, 70, 10), box(0, 0, 30, 10)]
        expect(getReorderOffsets(reversed, [1, 0, 2], { axis: 'x', reverse: true })).toEqual([-40, 30, 0])
    })

    it('packs items with a fixed gap instead of the gaps it measures', () => {
        // The first and last cells are stuck by sticky positioning away from where they would sit in the flow.
        const cells = [box(300, 0, 350, 10), box(100, 0, 200, 10), box(200, 0, 300, 10), box(500, 0, 520, 10)]

        expect(getReorderOffsets(cells, [0, 1, 2, 3], { axis: 'x', gap: 0 })).toEqual([0, 0, 0, 0])
        expect(getReorderOffsets(cells, [0, 2, 1, 3], { axis: 'x', gap: 0 })).toEqual([0, 100, -100, 0])

        // The same cells laid out right to left, with the stuck ones still in place.
        const reversed = [box(450, 0, 500, 10), box(300, 0, 400, 10), box(200, 0, 300, 10), box(0, 0, 20, 10)]
        expect(getReorderOffsets(reversed, [0, 1, 2, 3], { axis: 'x', reverse: true, gap: 0 })).toEqual([0, 0, 0, 0])
        expect(getReorderOffsets(reversed, [0, 2, 1, 3], { axis: 'x', reverse: true, gap: 0 })).toEqual([
            0, -100, 100, 0,
        ])
        expect(getReorderOffsets(rows, [2, 0, 1], { gap: 4 })).toEqual([14, 14, -68])
    })

    it('leaves every item in place for an order that is not a permutation of the items', () => {
        for (const order of [
            [0, 1],
            [0, 1, 1],
            [0, 1, 3],
            [0, 1, 2, 0],
            [0, 1.5, 2],
        ]) {
            expect(getReorderOffsets(rows, order)).toEqual([0, 0, 0])
        }
        expect(getReorderOffsets([], [])).toEqual([])
    })

    it('does not change its inputs', () => {
        const order = [2, 0, 1]
        const rects = rows.map((rect) => ({ ...rect }))

        getReorderOffsets(rects, order)
        expect(order).toEqual([2, 0, 1])
        expect(rects).toEqual(rows)
    })
})

describe('getScrollableAncestors', () => {
    const scrollable = (overflow: string, size: { width: number; height: number }) => {
        const element = document.createElement('div')
        element.style.overflowX = overflow
        element.style.overflowY = overflow
        Object.defineProperties(element, {
            clientWidth: { value: 100, configurable: true },
            clientHeight: { value: 100, configurable: true },
            scrollWidth: { value: size.width, configurable: true },
            scrollHeight: { value: size.height, configurable: true },
        })

        return element
    }

    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('lists scrollable ancestors nearest first, then the window, optionally along one axis', () => {
        const vertical = scrollable('auto', { width: 100, height: 400 })
        const horizontal = scrollable('auto', { width: 400, height: 100 })
        const clipped = scrollable('hidden', { width: 400, height: 400 })
        const item = document.createElement('div')
        document.body.append(vertical)
        vertical.append(clipped)
        clipped.append(horizontal)
        horizontal.append(item)

        expect(getScrollableAncestors(item)).toEqual([horizontal, vertical, window])
        expect(getScrollableAncestors(item, 'x')).toEqual([horizontal, window])
        expect(getScrollableAncestors(item, 'y')).toEqual([vertical, window])
    })

    it('crosses shadow roots', () => {
        const horizontal = scrollable('auto', { width: 400, height: 100 })
        const host = document.createElement('div')
        const item = document.createElement('div')
        document.body.append(horizontal)
        horizontal.append(host)
        host.attachShadow({ mode: 'open' }).append(item)

        expect(getScrollableAncestors(item, 'x')).toEqual([horizontal, window])
    })
})
