import { describe, expect, it } from 'vitest';
import { nonghyupKind, OTHER_BANKS, PRIMARY_BANKS } from '../src/lib/banks';

describe('bank catalog', () => {
  it('shows the approved primary banks in order', () => {
    expect(PRIMARY_BANKS.map((bank) => bank.label)).toEqual([
      'NH농협',
      'KB국민',
      '신한',
      '우리',
      '하나',
      'IBK기업',
      '카카오뱅크',
      '토스',
    ]);
  });

  it('provides additional banks behind the expanded list', () => {
    expect(OTHER_BANKS.length).toBeGreaterThan(0);
    expect(OTHER_BANKS.every((bank) => bank.kind === 'bank')).toBe(true);
  });
});

describe('nonghyupKind', () => {
  it.each<[string, ReturnType<typeof nonghyupKind>]>([
    ['NH농협은행', 'bank'],
    ['NH농협', 'bank'],
    ['농협은행', 'bank'],
    ['농협', 'bank'],
    ['서산농협', 'local'],
    ['지역농협', 'local'],
    ['한우축협', 'local'],
    ['지역 농축협', 'local'],
    ['신한', null],
  ])('%s -> %s', (bank, expected) => {
    expect(nonghyupKind(bank)).toBe(expected);
  });
});
