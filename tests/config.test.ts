import { describe, expect, it } from 'vitest';
import { getSeller, loadAppConfig } from '../src/config';

const validEnv = {
  VITE_SHOP_NAME: '행사 판매점',
  VITE_USER1_LABEL: '사용자 1',
  VITE_USER1_COLOR: '#155E75',
  VITE_USER1_BANK: '첫째은행',
  VITE_USER1_HOLDER: '홍길동',
  VITE_USER1_ACCOUNT: '123-456-7890',
  VITE_USER2_LABEL: '사용자 2',
  VITE_USER2_COLOR: '#9A3412',
  VITE_USER2_BANK: '둘째은행',
  VITE_USER2_HOLDER: '김영희',
  VITE_USER2_ACCOUNT: '987 654 3210',
};

describe('loadAppConfig', () => {
  it('parses two configured users and normalizes account copy values', () => {
    const result = loadAppConfig(validEnv);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sellers).toHaveLength(2);
    expect(result.value.sellers[0].accountDisplay).toBe('123-456-7890');
    expect(result.value.sellers[0].accountCopy).toBe('1234567890');
    expect(result.value.sellers[1].accountCopy).toBe('9876543210');
  });

  it.each([
    ['non-numeric account', { VITE_USER1_ACCOUNT: '123-ABC' }],
    ['placeholder value', { VITE_USER1_HOLDER: 'TODO' }],
    ['same colors', { VITE_USER2_COLOR: '#155E75' }],
  ])('returns a configuration error for %s', (_label, change) => {
    expect(loadAppConfig({ ...validEnv, ...change })).toEqual({
      ok: false,
      message: '계좌 설정이 필요합니다. 관리자에게 알려 주세요.',
    });
  });

  it('starts with one configured seller while the second account is not ready', () => {
    const result = loadAppConfig({
      ...validEnv,
      VITE_USER2_HOLDER: '',
      VITE_USER2_ACCOUNT: '',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sellers).toHaveLength(1);
    expect(result.value.sellers[0].id).toBe('1');
  });
});

describe('getSeller', () => {
  it('returns only a configured user', () => {
    const result = loadAppConfig(validEnv);
    if (!result.ok) throw new Error('fixture should be valid');

    expect(getSeller(result.value, '2')?.holder).toBe('김영희');
    expect(getSeller(result.value, '3')).toBeNull();
    expect(getSeller(result.value, null)).toBeNull();
  });
});
