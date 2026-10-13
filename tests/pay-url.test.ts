import { describe, expect, it } from 'vitest';
import { buildPayUrl, parsePaymentRequest } from '../src/lib/pay-url';

describe('buildPayUrl', () => {
  it('includes only the seller id and amount beneath the current site path', () => {
    const url = buildPayUrl('https://example.com/qr-pay/', '2', 45_000);

    expect(url).toBe('https://example.com/qr-pay/pay/?u=2&a=45000');
    expect(url).not.toMatch(/account|holder|bank|987/);
  });

  it.each([99, 500_001, 1.5])('rejects invalid amount %s', (amount) => {
    expect(() => buildPayUrl('https://example.com/', '1', amount)).toThrow(
      '올바른 금액이 아닙니다.',
    );
  });
});

describe('parsePaymentRequest', () => {
  it('parses a valid request', () => {
    expect(parsePaymentRequest('?u=1&a=100')).toEqual({
      ok: true,
      sellerId: '1',
      amount: 100,
    });
  });

  it.each(['?a=100', '?u=3&a=100', '?u=1&a=99', '?u=1&a=1.5'])(
    'blocks invalid request %s',
    (search) => {
      expect(parsePaymentRequest(search)).toEqual({
        ok: false,
        message: '이 QR로는 송금할 수 없습니다. 판매자에게 새 QR을 요청해 주세요.',
      });
    },
  );
});
