# String Utilities

Utility functions for string manipulation and validation.

## kebabCase

Converts a string to kebab-case.

```typescript
import { kebabCase } from '@inertiaui/vanilla'

kebabCase('camelCase')
// 'camel-case'

kebabCase('PascalCase')
// 'pascal-case'

kebabCase('snake_case')
// 'snake-case'

kebabCase('already-kebab-case')
// 'already-kebab-case'
```

### Handling Special Cases

```typescript
// Numbers are preserved
kebabCase('user123Name')
// 'user123-name'

// Multiple underscores are normalized
kebabCase('multiple__underscores')
// 'multiple-underscores'

// All uppercase
kebabCase('UPPERCASE')
// 'u-p-p-e-r-c-a-s-e'
```

## isStandardDomEvent

Checks if an event name is a standard DOM event.

```typescript
import { isStandardDomEvent } from '@inertiaui/vanilla'

isStandardDomEvent('onClick')     // true
isStandardDomEvent('onMouseOver') // true
isStandardDomEvent('onKeyDown')   // true
isStandardDomEvent('onCustom')    // false
```

### Supported Event Categories

- Mouse events: `click`, `dblclick`, `mousedown`, `mouseup`, `mouseover`, `mouseout`, `mousemove`, `mouseenter`, `mouseleave`
- Keyboard events: `keydown`, `keyup`, `keypress`
- Form events: `focus`, `blur`, `change`, `input`, `submit`, `reset`
- Window events: `load`, `unload`, `error`, `resize`, `scroll`
- Touch events: `touchstart`, `touchend`, `touchmove`, `touchcancel`
- Pointer events: `pointerdown`, `pointerup`, `pointermove`, `pointerenter`, `pointerleave`, `pointercancel`
- Drag events: `drag`, `dragstart`, `dragend`, `dragenter`, `dragleave`, `dragover`, `drop`
- Animation events: `animationstart`, `animationend`, `animationiteration`
- Transition events: `transitionstart`, `transitionend`, `transitionrun`, `transitioncancel`

### Case Insensitive

```typescript
isStandardDomEvent('onclick')  // true
isStandardDomEvent('ONCLICK')  // true
isStandardDomEvent('OnClick')  // true
```

### Use Case

Useful for distinguishing between standard DOM events and custom events when processing event handlers:

```typescript
const props = {
    onClick: handleClick,
    onMouseOver: handleHover,
    onModalReady: handleModalReady,
    onUserUpdated: handleUserUpdated,
}

const domEvents = {}
const customEvents = {}

for (const [key, value] of Object.entries(props)) {
    if (isStandardDomEvent(key)) {
        domEvents[key] = value
    } else {
        customEvents[key] = value
    }
}

// domEvents: { onClick, onMouseOver }
// customEvents: { onModalReady, onUserUpdated }
```
