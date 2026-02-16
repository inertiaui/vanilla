# Focus Management

Focus management utilities help create accessible dialogs by trapping focus and managing focusable elements.

## createFocusTrap

Creates a focus trap within a container element.

```typescript
import { createFocusTrap } from '@inertiaui/vanilla'

const cleanup = createFocusTrap(container, {
    initialFocus: true,
    initialFocusElement: null,
    returnFocus: true,
})

// Later, remove the focus trap
cleanup()
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialFocus` | `boolean` | `true` | Focus first element immediately |
| `initialFocusElement` | `HTMLElement \| null` | `null` | Specific element to focus initially |
| `returnFocus` | `boolean` | `true` | Return focus to previous element on cleanup |

### Behavior

The focus trap:
- Listens for Tab key and wraps focus at container boundaries
- Prevents focus from leaving the container via Tab or Shift+Tab
- Catches focus that escapes (e.g., via mouse click outside)
- Optionally focuses the first focusable element on creation
- Optionally returns focus to the previously focused element on cleanup

```typescript
const container = document.getElementById('dialog')
const submitButton = document.getElementById('submit')

const cleanup = createFocusTrap(container, {
    initialFocus: true,
    initialFocusElement: submitButton, // Focus submit button instead of first element
    returnFocus: true,
})
```

## getFocusableElements

Returns all focusable elements within a container.

```typescript
import { getFocusableElements } from '@inertiaui/vanilla'

const focusable = getFocusableElements(container)
// Returns: HTMLElement[]
```

Focusable elements include:
- `a[href]`
- `button:not([disabled])`
- `textarea:not([disabled])`
- `input:not([disabled])`
- `select:not([disabled])`
- `[tabindex]:not([tabindex="-1"])`

Elements with `aria-hidden` or `disabled` attributes are excluded.

## focusFirstElement

Focuses the first focusable element in a container.

```typescript
import { focusFirstElement } from '@inertiaui/vanilla'

const success = focusFirstElement(container)
// Returns: boolean (true if an element was focused)
```

```typescript
if (!focusFirstElement(dialogContent)) {
    // No focusable elements found, focus the container itself
    dialogContent.focus()
}
```
