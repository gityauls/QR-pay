import { describe, expect, it } from 'vitest';
import { applyKey, type KeypadKey } from '../src/lib/keypad';

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
