import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum.ts';

const implementations = [
  { name: 'sum_to_n_a (mathematical)', fn: sum_to_n_a },
  { name: 'sum_to_n_b (iterative)', fn: sum_to_n_b },
  { name: 'sum_to_n_c (recursive)', fn: sum_to_n_c },
];

describe('sum_to_n implementations', () => {
  implementations.forEach(({ name, fn }) => {
    describe(name, () => {
      it('should return 15 for n = 5', () => {
        assert.strictEqual(fn(5), 15);
      });

      it('should return 55 for n = 10', () => {
        assert.strictEqual(fn(10), 55);
      });

      it('should return 1 for n = 1', () => {
        assert.strictEqual(fn(1), 1);
      });

      it('should return 0 for n = 0', () => {
        assert.strictEqual(fn(0), 0);
      });

      it('should return 0 for negative numbers', () => {
        assert.strictEqual(fn(-5), 0);
        assert.strictEqual(fn(-1), 0);
      });

      it('should handle large numbers', () => {
        assert.strictEqual(fn(100), 5050);
        assert.strictEqual(fn(1000), 500500);
      });
    });
  });

  describe('all implementations produce consistent results', () => {
    const testValues = [0, 1, 5, 10, 50, 100, 500];

    testValues.forEach((n) => {
      it(`should return the same result for n = ${n}`, () => {
        const resultA = sum_to_n_a(n);
        const resultB = sum_to_n_b(n);
        const resultC = sum_to_n_c(n);

        assert.strictEqual(resultA, resultB);
        assert.strictEqual(resultB, resultC);
      });
    });
  });
});
