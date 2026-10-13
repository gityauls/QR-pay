import { describe, expect, it } from 'vitest';
import { formatWon, formatWonWords, parseAmount } from '../src/lib/money';

describe('parseAmount', () => {
  it.each([
    ['100', 100],
    ['45,000', 45_000],
    ['500000', 500_000],
  ])('parses valid integer won input %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', '99', '500001', '1.5', 'abc', '-100', 'NaN'])(
    'rejects invalid amount %s',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );
});

describe('won formatting', () => {
  it('formats digits with Korean separators', () => {
    expect(formatWon(45_000)).toBe('45,000원');
  });

  it.each([
    [100, '1백원'],
    [45_000, '4만 5천원'],
    [1_230_000, '123만원'],
  ])('reads %i won in Korean', (amount, expected) => {
    expect(formatWonWords(amount)).toBe(expected);
  });
});
