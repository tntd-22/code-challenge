# Problem 4: Three Ways to Sum to N

> **Duration**: You should not spend more than 2 hours on this problem.
> Time estimation is for internship roles, if you are a software professional you should spend significantly less time.

Three unique TypeScript implementations of a function that calculates the summation from 1 to n.

## Problem

**Input**: `n` - any integer

**Output**: Sum of integers from 1 to n, i.e., `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`

## Solutions

### `sum_to_n_a` - Mathematical Formula (Gauss's Formula)

```typescript
function sum_to_n_a(n: number): number {
  if (n <= 0) return 0;
  return (n * (n + 1)) / 2;
}
```

| Complexity | Value |
|------------|-------|
| Time       | O(1)  |
| Space      | O(1)  |

Uses the arithmetic series formula. Most efficient approach.

---

### `sum_to_n_b` - Iterative Loop

```typescript
function sum_to_n_b(n: number): number {
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    sum += i;
  }
  return sum;
}
```

| Complexity | Value |
|------------|-------|
| Time       | O(n)  |
| Space      | O(1)  |

Simple loop accumulator. Easy to understand.

---

### `sum_to_n_c` - Recursive

```typescript
function sum_to_n_c(n: number): number {
  if (n <= 0) return 0;
  return n + sum_to_n_c(n - 1);
}
```

| Complexity | Value |
|------------|-------|
| Time       | O(n)  |
| Space      | O(n)  |

Recursive approach. Elegant but uses call stack memory. Risk of stack overflow for very large n.

## Usage

```typescript
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum';

sum_to_n_a(5);  // 15
sum_to_n_b(10); // 55
sum_to_n_c(100); // 5050
```

## Running Tests

Requires Node.js v22+

```bash
node --test src/problem4/sum.spec.ts
```
