import { MAX_AMOUNT } from './money';

export type KeypadKey =
  | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | 'backspace'
  | 'clear';

export function applyKey(current: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'backspace') return current.slice(0, -1);

  const next = `${current}${key}`.replace(/^0+/, '');
  if (!next) return '';
  return Number(next) > MAX_AMOUNT ? current : next;
}
