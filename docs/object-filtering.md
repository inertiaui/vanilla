# Object Filtering

Utility functions for filtering objects and arrays.

## except

Returns an object or array without the specified keys/elements.

### Objects

```typescript
import { except } from '@inertiaui/vanilla'

const obj = { a: 1, b: 2, c: 3 }
except(obj, ['b'])
// { a: 1, c: 3 }
```

### Arrays

```typescript
const arr = ['a', 'b', 'c', 'd']
except(arr, ['b', 'd'])
// ['a', 'c']
```

### Case-Insensitive Matching

```typescript
const obj = { Name: 1, AGE: 2, city: 3 }
except(obj, ['name', 'age'], true)
// { city: 3 }

const arr = ['Name', 'AGE', 'city']
except(arr, ['name', 'age'], true)
// ['city']
```

## only

Returns an object or array with only the specified keys/elements.

### Objects

```typescript
import { only } from '@inertiaui/vanilla'

const obj = { a: 1, b: 2, c: 3 }
only(obj, ['a', 'c'])
// { a: 1, c: 3 }
```

### Arrays

```typescript
const arr = ['a', 'b', 'c', 'd']
only(arr, ['b', 'd'])
// ['b', 'd']
```

### Case-Insensitive Matching

```typescript
const obj = { Name: 1, AGE: 2, city: 3 }
only(obj, ['name', 'city'], true)
// { Name: 1, city: 3 }
```

## rejectNullValues

Removes null values from an object or array.

### Objects

```typescript
import { rejectNullValues } from '@inertiaui/vanilla'

const obj = { a: 1, b: null, c: 3 }
rejectNullValues(obj)
// { a: 1, c: 3 }
```

### Arrays

```typescript
const arr = [1, null, 3, null, 5]
rejectNullValues(arr)
// [1, 3, 5]
```

> [!TIP]
> `rejectNullValues` only removes `null` values, not `undefined`. Use this when you want to keep `undefined` values but remove explicit nulls.
