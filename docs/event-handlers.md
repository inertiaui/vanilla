# Event Handlers

Event handler utilities for common dialog interactions.

## onClickOutside

Registers a click outside handler.

```typescript
import { onClickOutside } from '@inertiaui/vanilla'

const cleanup = onClickOutside(element, (event) => {
    console.log('Clicked outside!')
})

// Later, remove the handler
cleanup()
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `event` | `'mousedown' \| 'mouseup' \| 'click'` | `'mousedown'` | Event type to listen for |
| `capture` | `boolean` | `true` | Use capture phase |

```typescript
const cleanup = onClickOutside(element, handleClickOutside, {
    event: 'mousedown',
    capture: true,
})
```

> [!TIP]
> Using `mousedown` (the default) provides a more responsive feel than `click`, as it triggers before the mouse button is released.

## onEscapeKey

Registers an Escape key handler.

```typescript
import { onEscapeKey } from '@inertiaui/vanilla'

const cleanup = onEscapeKey((event) => {
    console.log('Escape pressed!')
})

// Later, remove the handler
cleanup()
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preventDefault` | `boolean` | `false` | Call `event.preventDefault()` |
| `stopPropagation` | `boolean` | `false` | Call `event.stopPropagation()` |

```typescript
const cleanup = onEscapeKey(handleEscape, {
    preventDefault: true,
    stopPropagation: true,
})
```

## Cleanup Pattern

Both functions return cleanup functions that remove event listeners:

```typescript
import { onEscapeKey, onClickOutside } from '@inertiaui/vanilla'

const cleanups = [
    onEscapeKey(() => closeDialog()),
    onClickOutside(dialog, () => closeDialog()),
]

// Later, clean up all handlers
cleanups.forEach(cleanup => cleanup())
```

This pattern is used throughout the library and integrates well with framework lifecycle hooks:

```typescript
// Vue
onMounted(() => {
    cleanup = onEscapeKey(close)
})
onUnmounted(() => {
    cleanup()
})

// React
useEffect(() => {
    const cleanup = onEscapeKey(close)
    return cleanup
}, [])
```
