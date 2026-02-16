# Introduction

Inertia UI Vanilla is a framework-agnostic TypeScript library providing UI utilities for dialogs, focus management, and common helper functions. It's designed to work with any JavaScript/TypeScript project.

Here's a summary of the features:

- Full TypeScript support with exported types
- Dialog management with scroll locking, focus trapping, and accessibility
- Cleanup function pattern for proper resource management
- Reference counting for nested dialogs
- Common utility functions for objects, arrays, and strings

## Quick Example

The library makes it easy to create accessible dialogs with proper focus management:

```typescript
import { createDialog } from '@inertiaui/vanilla'

const dialog = createDialog(dialogElement, {
    closeOnEscape: true,
    closeOnClickOutside: true,
    trapFocus: true,
    lockScroll: true,
    onClose: () => hideDialog(),
})

// Open the dialog
dialog.activate()

// Close the dialog
dialog.deactivate()
```

All functions that set up event listeners return cleanup functions, making it easy to manage resources:

```typescript
import { onEscapeKey, onClickOutside } from '@inertiaui/vanilla'

const cleanupEscape = onEscapeKey(() => closeModal())
const cleanupClickOutside = onClickOutside(element, () => closeModal())

// Later, clean up
cleanupEscape()
cleanupClickOutside()
```
