# createDialog

The `createDialog` function creates a managed dialog instance with scroll locking, focus trapping, click outside detection, and escape key handling.

## Basic Usage

```typescript
import { createDialog } from '@inertiaui/vanilla'

const dialog = createDialog(dialogElement, {
    onClose: () => hideDialog(),
})

// Open the dialog
dialog.activate()

// Close the dialog
dialog.deactivate()

// Check if active
console.log(dialog.isActive)
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `appElement` | `string \| null` | `'#app'` | Element to mark as `aria-hidden` when dialog opens |
| `closeOnEscape` | `boolean` | `true` | Close dialog when Escape key is pressed |
| `closeOnClickOutside` | `boolean` | `true` | Close dialog when clicking outside |
| `trapFocus` | `boolean` | `true` | Trap focus within the dialog |
| `lockScroll` | `boolean` | `true` | Lock body scroll when dialog opens |
| `initialFocus` | `boolean` | `true` | Focus first element when dialog opens |
| `initialFocusElement` | `HTMLElement \| null` | `null` | Specific element to focus initially |
| `returnFocus` | `boolean` | `true` | Return focus to previous element on close |
| `onClose` | `() => void \| null` | `null` | Callback for close actions |

## Full Example

```typescript
import { createDialog } from '@inertiaui/vanilla'

const dialogElement = document.getElementById('my-dialog')

const dialog = createDialog(dialogElement, {
    appElement: '#app',
    closeOnEscape: true,
    closeOnClickOutside: true,
    trapFocus: true,
    lockScroll: true,
    initialFocus: true,
    initialFocusElement: document.getElementById('first-input'),
    returnFocus: true,
    onClose: () => {
        dialogElement.hidden = true
    },
})

// Show dialog
function showDialog() {
    dialogElement.hidden = false
    dialog.activate()
}

// Hide dialog
function hideDialog() {
    dialog.deactivate()
    dialogElement.hidden = true
}
```

## Nested Dialogs

The `createDialog` function supports nested dialogs through reference counting. When multiple dialogs are open:

- Scroll locking is maintained until all dialogs are closed
- `aria-hidden` attributes are properly managed
- Focus is returned to the correct element when each dialog closes

```typescript
const parentDialog = createDialog(parentElement, { onClose: closeParent })
const childDialog = createDialog(childElement, { onClose: closeChild })

// Open parent, then child
parentDialog.activate()
childDialog.activate()

// Close child first - scroll stays locked, parent regains focus
childDialog.deactivate()

// Close parent - scroll unlocks, original element regains focus
parentDialog.deactivate()
```
