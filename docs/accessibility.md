# Accessibility

Accessibility utilities for managing `aria-hidden` attributes with reference counting support.

## markAriaHidden

Marks an element as `aria-hidden="true"` and returns a cleanup function.

```typescript
import { markAriaHidden } from '@inertiaui/vanilla'

const cleanup = markAriaHidden('#app')

// Later, restore
cleanup()
```

Accepts either an element or a CSS selector:

```typescript
// Using selector
const cleanup = markAriaHidden('#app')

// Using element
const element = document.getElementById('app')
const cleanup = markAriaHidden(element)
```

## unmarkAriaHidden

Directly decrements the aria-hidden reference count for an element.

```typescript
import { markAriaHidden, unmarkAriaHidden } from '@inertiaui/vanilla'

const element = document.getElementById('app')

markAriaHidden(element)
// ... later
unmarkAriaHidden(element)
```

## Reference Counting

Like scroll locking, `aria-hidden` management uses reference counting for nested dialogs:

```typescript
import { markAriaHidden } from '@inertiaui/vanilla'

const cleanup1 = markAriaHidden('#app')
const cleanup2 = markAriaHidden('#app')

// Element is aria-hidden="true"

cleanup1()
// Element is still aria-hidden="true" (one reference remaining)

cleanup2()
// Element's aria-hidden is restored to original value
```

## Original Value Preservation

The original `aria-hidden` value is preserved and restored:

```typescript
const element = document.getElementById('sidebar')
element.setAttribute('aria-hidden', 'false')

const cleanup = markAriaHidden(element)
console.log(element.getAttribute('aria-hidden')) // 'true'

cleanup()
console.log(element.getAttribute('aria-hidden')) // 'false' (restored)
```

If the element had no `aria-hidden` attribute, the attribute is removed on cleanup:

```typescript
const element = document.getElementById('main')
// No aria-hidden attribute

const cleanup = markAriaHidden(element)
console.log(element.getAttribute('aria-hidden')) // 'true'

cleanup()
console.log(element.getAttribute('aria-hidden')) // null (removed)
```

## Use with Dialogs

When a dialog opens, the main content should be marked as `aria-hidden` to prevent screen readers from reading background content:

```typescript
import { markAriaHidden } from '@inertiaui/vanilla'

function openDialog() {
    const cleanup = markAriaHidden('#app')

    // Store cleanup for later
    dialogState.ariaCleanup = cleanup
}

function closeDialog() {
    dialogState.ariaCleanup?.()
}
```

> [!TIP]
> The `createDialog` function handles this automatically via the `appElement` option.
