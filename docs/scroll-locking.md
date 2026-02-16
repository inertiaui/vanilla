# Scroll Locking

The scroll locking utilities prevent body scroll while dialogs are open, with reference counting support for nested dialogs.

## lockScroll

Locks body scroll and returns a cleanup function.

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

## unlockScroll

Directly decrements the scroll lock count.

```typescript
import { lockScroll, unlockScroll } from '@inertiaui/vanilla'

lockScroll()
// ... later
unlockScroll()
```

## getScrollLockCount

Returns the current number of active scroll locks.

```typescript
import { lockScroll, getScrollLockCount } from '@inertiaui/vanilla'

lockScroll()
lockScroll()
console.log(getScrollLockCount()) // 2
```

## Reference Counting

Multiple calls to `lockScroll` are reference counted. The body scroll is only restored when all locks are released:

```typescript
import { lockScroll, getScrollLockCount } from '@inertiaui/vanilla'

const unlock1 = lockScroll()
const unlock2 = lockScroll()

console.log(getScrollLockCount()) // 2
console.log(document.body.style.overflow) // 'hidden'

unlock1()
console.log(getScrollLockCount()) // 1
console.log(document.body.style.overflow) // 'hidden' (still locked)

unlock2()
console.log(getScrollLockCount()) // 0
console.log(document.body.style.overflow) // '' (restored)
```

## Idempotent Unlock

Each cleanup function can only unlock once, preventing accidental double-unlocking:

```typescript
const unlock = lockScroll()
unlock() // Decrements count
unlock() // No effect
unlock() // No effect
```
