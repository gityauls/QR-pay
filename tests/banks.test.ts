import { describe, expect, it } from 'vitest';
import { OTHER_BANKS, PRIMARY_BANKS } from '../src/lib/banks';

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
