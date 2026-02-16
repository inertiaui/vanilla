# @inertiaui/vanilla

A vanilla TypeScript library providing UI utilities for dialogs, focus management, and common helper functions.

## Installation

```bash
npm install @inertiaui/vanilla
```

## Documentation

See the [full documentation](./docs/) for detailed usage and API reference.

## Quick Example

```typescript
import { createDialog } from '@inertiaui/vanilla'

const dialog = createDialog(dialogElement, {
    closeOnEscape: true,
    closeOnClickOutside: true,
    trapFocus: true,
    onClose: () => hideDialog(),
})

dialog.activate()
dialog.deactivate()
```

## License

MIT
