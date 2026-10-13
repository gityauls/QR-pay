import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config';
import { createSellerApp } from '../src/seller/main';

const config: AppConfig = {
  shopName: '행사 판매점',
  sellers: [
    {
      id: '1',
      label: '사용자 1',
      color: '#155E75',
      bank: '첫째은행',
      holder: '홍길동',
      accountDisplay: '123-456-7890',
      accountCopy: '1234567890',
    },
    {
      id: '2',
      label: '사용자 2',
      color: '#9A3412',
      bank: '둘째은행',
      holder: '김영희',
      accountDisplay: '987-654-3210',
      accountCopy: '9876543210',
    },
  ],
};

function root() {
  const element = document.createElement('main');
  document.body.append(element);
  return element;
}

function button(element: ParentNode, text: string): HTMLButtonElement {
  const found = [...element.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(text),
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${text}`);
  return found;
}

describe('seller view', () => {
  it('starts with two large user choices when no user was remembered', () => {
    const element = root();
    createSellerApp(element, config, {
      storage: localStorage,
      baseUrl: 'https://example.com/qr-pay/',
      makeQr: vi.fn(),
      now: () => new Date('2026-10-13T12:00:00+09:00'),
    });

    expect(element.textContent).toContain('누가 받으시나요?');
    expect(button(element, '사용자 1').disabled).toBe(false);
    expect(button(element, '사용자 2').disabled).toBe(false);
  });

  it('remembers the user and keeps QR disabled until a valid amount is entered', () => {
    const element = root();
    localStorage.setItem('qrpay.currentSeller', '2');
    createSellerApp(element, config, {
      storage: localStorage,
      baseUrl: 'https://example.com/qr-pay/',
      makeQr: vi.fn(),
      now: () => new Date('2026-10-13T12:00:00+09:00'),
    });

    expect(element.textContent).toContain('사용자 2 계좌로 받는 중');
    const showQr = button(element, 'QR 보여주기');
    expect(showQr.disabled).toBe(true);

    const input = element.querySelector<HTMLInputElement>('[data-testid="amount-input"]');
    if (!input) throw new Error('amount input not found');
    input.value = '45000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(showQr.disabled).toBe(false);
    expect(element.textContent).toContain('45,000원');
  });

  it('creates an account-free QR URL and records only after confirmation', async () => {
    const element = root();
    const makeQr = vi
      .fn<(url: string) => Promise<string>>()
      .mockResolvedValue('data:image/png;base64,qr');
    localStorage.setItem('qrpay.currentSeller', '1');
    createSellerApp(element, config, {
      storage: localStorage,
      baseUrl: 'https://example.com/qr-pay/',
      makeQr,
      now: () => new Date('2026-10-13T12:00:00+09:00'),
    });

    const input = element.querySelector<HTMLInputElement>('[data-testid="amount-input"]');
    if (!input) throw new Error('amount input not found');
    input.value = '45000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button(element, 'QR 보여주기').click();
    await vi.waitFor(() => expect(makeQr).toHaveBeenCalledOnce());

    const qrUrl = makeQr.mock.calls[0][0];
    expect(qrUrl).toBe('https://example.com/qr-pay/pay/?u=1&a=45000');
    expect(qrUrl).not.toContain('1234567890');
    expect(localStorage.getItem('qrpay.sales')).toBeNull();

    button(element, '입금 확인 후 다음 손님').click();
    expect(JSON.parse(localStorage.getItem('qrpay.sales') ?? '[]')).toHaveLength(1);
    expect(element.textContent).toContain('금액을 입력해 주세요');
  });

  it('shows today records only after opening the records view', () => {
    const element = root();
    localStorage.setItem('qrpay.currentSeller', '1');
    localStorage.setItem(
      'qrpay.sales',
      JSON.stringify([
        { occurredAt: '2026-10-13T10:00:00+09:00', sellerId: '1', amount: 1000 },
      ]),
    );
    createSellerApp(element, config, {
      storage: localStorage,
      baseUrl: 'https://example.com/qr-pay/',
      makeQr: vi.fn(),
      now: () => new Date('2026-10-13T12:00:00+09:00'),
    });

    expect(element.textContent).not.toContain('오늘 판매 1건');
    button(element, '기록 보기').click();
    expect(element.textContent).toContain('오늘 판매 1건');
    expect(element.textContent).toContain('1,000원');
  });
});
