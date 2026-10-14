import { describe, expect, it } from 'vitest';
import { addAmount, applyKey, type KeypadKey } from '../src/lib/keypad';

describe('applyKey', () => {
  it.each<[string, KeypadKey, string]>([
    ['', '1', '1'],
    ['14', '0', '140'],
    ['14000', 'backspace', '1400'],
    ['14000', 'clear', ''],
    ['500000', '0', '500000'],
    ['', '0', ''],
  ])('%s + %s -> %s', (current, key, expected) => {
    expect(applyKey(current, key)).toBe(expected);
  });
});

describe('addAmount', () => {
  it.each<[string, number, string]>([
    ['', 10_000, '10000'],
    ['10000', 5_000, '15000'],
    ['15000', 1_000, '16000'],
    ['495000', 10_000, '495000'],
    ['495000', 5_000, '500000'],
  ])('%s + %i -> %s', (current, step, expected) => {
    expect(addAmount(current, step)).toBe(expected);
  });
});
