import { describe, expect, it } from 'vitest';
import type { Seller } from '../src/config';
import { buildPayUrl, parsePaymentRequest } from '../src/lib/pay-url';

const seller: Seller = {
  id: 'seller-한글',
  label: '장모님',
  color: '#9A3412',
  bank: '신한은행',
  holder: '김영희',
  accountDisplay: '987-654-3210',
  accountCopy: '9876543210',
};

describe('fragment payment URL', () => {
  it('round-trips UTF-8 shop, recipient, account, and amount', () => {
    const url = buildPayUrl('https://example.com/QR-pay/', '김선비 벌꿀', seller, 45_000);
    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}${parsed.search}`).toBe('https://example.com/QR-pay/pay/');
    expect(url.slice(0, url.indexOf('#'))).not.toContain('9876543210');
    expect(parsePaymentRequest(parsed.hash)).toEqual({
      ok: true,
      shopName: '김선비 벌꿀',
      seller,
      amount: 45_000,
    });
  });

  it.each([99, 500_001, 1.5])('rejects invalid amount %s', (amount) => {
    expect(() => buildPayUrl('https://example.com/', '상점', seller, amount)).toThrow(
      '올바른 금액이 아닙니다.',
    );
  });

  it.each(['', '#broken', '#eyJ2IjoyfQ'])('blocks malformed or unsupported payload %s', (hash) => {
    const result = parsePaymentRequest(hash);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('이 QR로는 송금할 수 없습니다');
  });

  it('rejects an oversized fragment before decoding it', () => {
    expect(parsePaymentRequest(`#${'a'.repeat(4001)}`).ok).toBe(false);
  });
});
