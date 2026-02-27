# Inertia UI Vanilla

A lightweight vanilla TypeScript library providing UI utilities for dialogs, animations, focus management, and common helper functions. Framework-agnostic and designed to integrate seamlessly with Vue, React, or any JavaScript application.

This package is part of the [Inertia UI](https://inertiaui.com) suite. Check out our other packages:

- **[Inertia Modal](https://inertiaui.com/inertia-modal)**: Turn any Laravel route into a modal or slideover with a single component. No backend changes needed, with support for nested/stacked modals and inter-modal communication. Works with Vue and React.
- **[Inertia Table](https://inertiaui.com/inertia-table)**: The most complete data table package for Laravel and Inertia.js. Sorting, searching, and filtering across relationships, bulk actions, CSV/Excel/PDF exports, sticky headers, and much more. Works with Vue and React.

[![Inertia UI](https://inertiaui.com/visit-card.jpg)](https://inertiaui.com)

## Installation

```bash
npm install @inertiaui/vanilla
```

## Table of Contents

- [Scroll Locking](#scroll-locking)
- [Focus Management](#focus-management)
- [Keyboard Events](#keyboard-events)
- [Accessibility](#accessibility)
- [Animation](#animation)
- [Helpers](#helpers)
  - [generateId](#generateid)
  - [Object Filtering](#object-filtering)
  - [String Utilities](#string-utilities)
  - [URL Utilities](#url-utilities)

## Scroll Locking

The `lockScroll` function prevents body scroll while dialogs or modals are open, with reference counting support for nested dialogs.

### Basic Usage

```typescript
import { lockScroll } from '@inertiaui/vanilla'

const unlock = lockScroll()

// Later, unlock
unlock()
```

The function:

- Sets `document.body.style.overflow` to `'hidden'`
- Adds padding to compensate for scrollbar width (prevents layout shift)
- Returns a cleanup function that can only unlock once

### Reference Counting

Multiple calls to `lockScroll` are reference counted. The body scroll is only restored when all locks are released:

```typescript
import { lockScroll } from '@inertiaui/vanilla'

const unlock1 = lockScroll()
const unlock2 = lockScroll()

// Body is locked

unlock1()
// Body is still locked (one reference remaining)

unlock2()
// Body scroll is restored
```

### Idempotent Unlock

Each cleanup function can only unlock once, preventing accidental double-unlocking:

```typescript
const unlock = lockScroll()
unlock() // Decrements count
unlock() // No effect
unlock() // No effect
```

## Focus Management

Focus management utilities help create accessible dialogs by trapping focus and managing focusable elements.

### createFocusTrap

Creates a focus trap within a container element.

```typescript
import { createFocusTrap } from '@inertiaui/vanilla'

const cleanup = createFocusTrap(dialogElement)

// Later, remove the focus trap
cleanup()
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialFocus` | `boolean` | `true` | Focus first element immediately |
| `initialFocusElement` | `HTMLElement \| null` | `null` | Specific element to focus initially |
| `returnFocus` | `boolean` | `true` | Return focus to previous element on cleanup |

#### Behavior

The focus trap:

- Listens for Tab key and wraps focus at container boundaries
- Prevents focus from leaving the container via Tab or Shift+Tab
- Catches focus that escapes (e.g., via mouse click outside)
- Optionally focuses the first focusable element on creation
- Optionally returns focus to the previously focused element on cleanup
- Supports nesting: when multiple traps are active, only the most recently created trap receives focus. Cleaning up the inner trap restores the outer trap.

```typescript
const container = document.getElementById('dialog')!
const submitButton = document.getElementById('submit')

const cleanup = createFocusTrap(container, {
    initialFocusElement: submitButton, // Focus submit button instead of first element
})
```

#### Focusable Elements

The focus trap recognizes these elements as focusable:

- `a[href]`
- `button:not([disabled])`
- `textarea:not([disabled])`
- `input:not([disabled])`
- `select:not([disabled])`
- `[tabindex]:not([tabindex="-1"])`

Elements with `aria-hidden="true"` are excluded. (Elements with `disabled` are already filtered by the selectors above.)

## Keyboard Events

### onEscapeKey

Registers an Escape key handler.

```typescript
import { onEscapeKey } from '@inertiaui/vanilla'

const cleanup = onEscapeKey((event) => {
    console.log('Escape pressed!')
})

// Later, remove the handler
cleanup()
```

#### Options

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

### Cleanup Pattern

The cleanup function pattern integrates well with framework lifecycle hooks:

```typescript
// Vue (<script setup>)
const cleanup = onEscapeKey(closeDialog)
onUnmounted(() => cleanup())

// React
useEffect(() => {
    return onEscapeKey(closeDialog)
}, [])
```

## Accessibility

Accessibility utilities for managing `aria-hidden` attributes with reference counting support.

### markAriaHidden

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
const cleanup1 = markAriaHidden('#app')

// Using element
const element = document.getElementById('app')!
const cleanup2 = markAriaHidden(element)
```

### Reference Counting

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

### Original Value Preservation

The original `aria-hidden` value is preserved and restored:

```typescript
const element = document.getElementById('sidebar')!
element.setAttribute('aria-hidden', 'false')

const cleanup = markAriaHidden(element)
element.getAttribute('aria-hidden') // 'true'

cleanup()
element.getAttribute('aria-hidden') // 'false' (restored)
```

If the element had no `aria-hidden` attribute, the attribute is removed on cleanup:

```typescript
const element = document.getElementById('main')!
// No aria-hidden attribute

const cleanup = markAriaHidden(element)
element.getAttribute('aria-hidden') // 'true'

cleanup()
element.getAttribute('aria-hidden') // null (removed)
```

### Use with Dialogs

When a dialog opens, the main content should be marked as `aria-hidden` to prevent screen readers from reading background content:

```typescript
import { markAriaHidden, lockScroll, createFocusTrap, onEscapeKey } from '@inertiaui/vanilla'

function openDialog(dialogElement: HTMLElement) {
    const closeDialog = () => cleanups.forEach(fn => fn())

    const cleanups = [
        markAriaHidden('#app'),
        lockScroll(),
        createFocusTrap(dialogElement),
        onEscapeKey(closeDialog),
    ]

    return closeDialog
}
```

## Animation

The animation module provides a simple wrapper around the Web Animations API with Tailwind CSS-compatible easing functions.

### animate

Animate an element using the Web Animations API. Returns a promise that resolves when the animation completes. If the animation is cancelled (e.g., by calling `cancelAnimations`), the promise resolves with the `Animation` object instead of rejecting.

```typescript
import { animate } from '@inertiaui/vanilla'

await animate(element, [
    { transform: 'scale(0.95)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1 }
])
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | `number` | `300` | Animation duration in milliseconds |
| `easing` | `string \| EasingName` | `'inOut'` | Easing function (see below) |
| `fill` | `FillMode` | `'forwards'` | Animation fill mode |

```typescript
await animate(element, keyframes, { duration: 200, easing: 'out' })
```

### easings

Pre-defined easing functions matching Tailwind CSS:

```typescript
import { easings } from '@inertiaui/vanilla'

// Available easings:
easings.linear  // 'linear'
easings.in      // 'cubic-bezier(0.4, 0, 1, 1)'
easings.out     // 'cubic-bezier(0, 0, 0.2, 1)'
easings.inOut   // 'cubic-bezier(0.4, 0, 0.2, 1)'
```

You can use easing names directly:

```typescript
await animate(element, keyframes, { easing: 'out' })
```

Or provide a custom easing string:

```typescript
await animate(element, keyframes, { easing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)' })
```

### cancelAnimations

Cancel any running animations on an element:

```typescript
import { cancelAnimations } from '@inertiaui/vanilla'

cancelAnimations(element)
```

### Full Example

```typescript
import { animate, cancelAnimations } from '@inertiaui/vanilla'

async function showModal(modal: HTMLElement) {
    modal.hidden = false

    await animate(modal, [
        { transform: 'scale(0.95)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
    ], { duration: 150, easing: 'out' })
}

async function hideModal(modal: HTMLElement) {
    await animate(modal, [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.95)', opacity: 0 }
    ], { duration: 100, easing: 'in' })

    modal.hidden = true
}

function forceHideModal(modal: HTMLElement) {
    cancelAnimations(modal)
    modal.hidden = true
}
```

## Helpers

### generateId

Generates a unique ID using `crypto.randomUUID()` with a fallback for environments where it's not available.

```typescript
import { generateId } from '@inertiaui/vanilla'

const id = generateId()
// 'inertiaui_550e8400-e29b-41d4-a716-446655440000'
```

#### Custom Prefix

```typescript
generateId('modal_')
// 'modal_550e8400-e29b-41d4-a716-446655440000'

generateId('dialog-')
// 'dialog-550e8400-e29b-41d4-a716-446655440000'
```

#### Fallback

In environments where `crypto.randomUUID()` is not available, the function falls back to a combination of timestamp and random string:

```typescript
// Fallback format:
// '{prefix}{timestamp}_{random}'
// 'inertiaui_m5x2k9p_7h3j5k9a2'
```

#### Use Cases

Useful for generating unique IDs for:

- Dialog instances
- Form elements requiring unique IDs
- Accessibility attributes (`aria-labelledby`, `aria-describedby`)
- Tracking modal instances

```typescript
const dialogId = generateId('dialog_')
const titleId = generateId('title_')
const descId = generateId('desc_')

dialog.setAttribute('aria-labelledby', titleId)
dialog.setAttribute('aria-describedby', descId)
title.id = titleId
description.id = descId
```

### Object Filtering

#### except

Returns an object or array without the specified keys/elements.

**Objects:**

```typescript
import { except } from '@inertiaui/vanilla'

const obj = { a: 1, b: 2, c: 3 }
except(obj, ['b'])
// { a: 1, c: 3 }
```

**Arrays:**

```typescript
const arr = ['a', 'b', 'c', 'd']
except(arr, ['b', 'd'])
// ['a', 'c']
```

**Case-Insensitive Matching:**

```typescript
const obj = { Name: 1, AGE: 2, city: 3 }
except(obj, ['name', 'age'], true)
// { city: 3 }

const arr = ['Name', 'AGE', 'city']
except(arr, ['name', 'age'], true)
// ['city']
```

#### only

Returns an object or array with only the specified keys/elements.

**Objects:**

```typescript
import { only } from '@inertiaui/vanilla'

const obj = { a: 1, b: 2, c: 3 }
only(obj, ['a', 'c'])
// { a: 1, c: 3 }
```

**Arrays:**

```typescript
const arr = ['a', 'b', 'c', 'd']
only(arr, ['b', 'd'])
// ['b', 'd']
```

**Case-Insensitive Matching:**

```typescript
const obj = { Name: 1, AGE: 2, city: 3 }
only(obj, ['name', 'city'], true)
// { Name: 1, city: 3 }
```

#### rejectNullValues

Removes null values from an object or array.

**Objects:**

```typescript
import { rejectNullValues } from '@inertiaui/vanilla'

const obj = { a: 1, b: null, c: 3 }
rejectNullValues(obj)
// { a: 1, c: 3 }
```

**Arrays:**

```typescript
const arr = [1, null, 3, null, 5]
rejectNullValues(arr)
// [1, 3, 5]
```

> **Note:** `rejectNullValues` only removes `null` values, not `undefined`. Use this when you want to keep `undefined` values but remove explicit nulls.

### String Utilities

#### kebabCase

Converts a string to kebab-case.

```typescript
import { kebabCase } from '@inertiaui/vanilla'

kebabCase('camelCase')       // 'camel-case'
kebabCase('PascalCase')      // 'pascal-case'
kebabCase('snake_case')      // 'snake-case'
kebabCase('already-kebab')   // 'already-kebab'
```

**Handling Special Cases:**

```typescript
kebabCase('user123Name')           // 'user123-name'
kebabCase('multiple__underscores') // 'multiple-underscores'
kebabCase('UPPERCASE')             // 'uppercase'
kebabCase('XMLDocument')           // 'xml-document'
kebabCase('hello world')           // 'hello-world'
```

#### isStandardDomEvent

Checks if an event name is a standard DOM event.

```typescript
import { isStandardDomEvent } from '@inertiaui/vanilla'

isStandardDomEvent('onClick')     // true
isStandardDomEvent('onMouseOver') // true
isStandardDomEvent('onKeyDown')   // true
isStandardDomEvent('onCustom')    // false
```

**Supported Event Categories:**

- Mouse events: `click`, `dblclick`, `mousedown`, `mouseup`, `mouseover`, `mouseout`, `mousemove`, `mouseenter`, `mouseleave`
- Keyboard events: `keydown`, `keyup`, `keypress`
- Form events: `focus`, `blur`, `change`, `input`, `submit`, `reset`
- Window events: `load`, `unload`, `error`, `resize`, `scroll`
- Touch events: `touchstart`, `touchend`, `touchmove`, `touchcancel`
- Pointer events: `pointerdown`, `pointerup`, `pointermove`, `pointerenter`, `pointerleave`, `pointercancel`
- Drag events: `drag`, `dragstart`, `dragend`, `dragenter`, `dragleave`, `dragover`, `drop`
- Animation events: `animationstart`, `animationend`, `animationiteration`
- Transition events: `transitionstart`, `transitionend`, `transitionrun`, `transitioncancel`

**Case Insensitive:**

```typescript
isStandardDomEvent('onclick')  // true
isStandardDomEvent('ONCLICK')  // true
isStandardDomEvent('OnClick')  // true
```

**Use Case:**

Useful for distinguishing between standard DOM events and custom events when processing event handlers:

```typescript
const props: Record<string, Function> = {
    onClick: handleClick,
    onMouseOver: handleHover,
    onModalReady: handleModalReady,
    onUserUpdated: handleUserUpdated,
}

const domEvents: Record<string, Function> = {}
const customEvents: Record<string, Function> = {}

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

### URL Utilities

#### sameUrlPath

Compares two URLs to determine if they have the same origin and pathname, ignoring query strings and hash fragments.

```typescript
import { sameUrlPath } from '@inertiaui/vanilla'

sameUrlPath('/users/1', '/users/1')           // true
sameUrlPath('/users/1', '/users/1?tab=posts') // true
sameUrlPath('/users/1', '/users/2')           // false
sameUrlPath('/users', '/posts')               // false
```

**Accepts URL objects:**

```typescript
const url1 = new URL('https://example.com/users/1')
const url2 = new URL('https://example.com/users/1?page=2')

sameUrlPath(url1, url2) // true
```

**Handles null/undefined:**

```typescript
sameUrlPath(null, '/users')      // false
sameUrlPath('/users', undefined) // false
sameUrlPath(null, null)          // false
```

**Use Case:**

Useful for determining active navigation states or comparing the current route with a link destination:

```typescript
const isActive = sameUrlPath(window.location.href, linkHref)
```

## TypeScript

This library is written in TypeScript and exports the following types:

```typescript
import type {
    CleanupFunction,
    FocusTrapOptions,
    EscapeKeyOptions,
    AnimateOptions,
    EasingName,
} from '@inertiaui/vanilla'
```

## License

MIT
