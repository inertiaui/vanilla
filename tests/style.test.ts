import { captureInlineStyles } from '../src/style'

describe('captureInlineStyles', () => {
    it('restores captured inline values with their priorities, all or only some', () => {
        const element = document.createElement('div')
        element.style.setProperty('z-index', '3', 'important')
        element.style.setProperty('transform', 'translateX(4px)')

        const styles = captureInlineStyles(element, ['z-index', 'transform', 'position'])
        element.style.zIndex = '9'
        element.style.transform = 'translateX(40px)'
        element.style.position = 'relative'

        styles.restore(['transform'])
        expect(element.style.transform).toBe('translateX(4px)')
        expect(element.style.zIndex).toBe('9')

        styles.restore()
        expect([element.style.getPropertyValue('z-index'), element.style.getPropertyPriority('z-index')]).toEqual([
            '3',
            'important',
        ])
        expect(element.style.position).toBe('')
        expect(element.getAttribute('style')).not.toContain('position')
    })

    it('keeps each value with its property when the caller changes the list afterwards', () => {
        const element = document.createElement('div')
        element.style.setProperty('z-index', '3')
        element.style.setProperty('transform', 'translateX(4px)')
        const properties = ['z-index', 'transform']

        const styles = captureInlineStyles(element, properties)
        properties.reverse()
        element.style.zIndex = '9'
        element.style.transform = 'none'

        styles.restore()
        expect([element.style.zIndex, element.style.transform]).toEqual(['3', 'translateX(4px)'])
    })

    it('ignores properties it did not capture', () => {
        const element = document.createElement('div')
        const styles = captureInlineStyles(element, ['transform'])
        element.style.opacity = '0.5'

        styles.restore(['opacity'])
        expect(element.style.opacity).toBe('0.5')
    })
})
