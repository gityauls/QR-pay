import { describe, expect, it } from 'vitest';
import { formatWon, formatWonWords, parseAmount } from '../src/lib/money';

describe('parseAmount', () => {
  it.each([
    ['1000', 1_000],
    ['14,000', 14_000],
    ['500000', 500_000],
  ])('parses valid thousand-won input %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', '100', '1100', '14500', '500001', '1.5', 'abc', '-1000', 'NaN'])(
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
