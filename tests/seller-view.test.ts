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
      bank: 'NH농협',
      holder: '홍길동',
      accountDisplay: '123-456-7890',
      accountCopy: '1234567890',
    },
    {
      id: '2',
      label: '사용자 2',
      color: '#9A3412',
      bank: 'KB국민',
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

function createDependencies(overrides: Record<string, unknown> = {}) {
  return {
    storage: localStorage,
    baseUrl: 'https://example.com/qr-pay/',
    makeQr: vi.fn<(url: string) => Promise<string>>().mockResolvedValue('data:image/png;base64,qr'),
    now: () => new Date('2026-10-14T12:00:00+09:00'),
    timers: {
      setTimeout: vi.fn((_callback: () => void, _delay: number) => 1),
      clearTimeout: vi.fn(),
      setInterval: vi.fn((_callback: () => void, _delay: number) => 2),
      clearInterval: vi.fn(),
    },
    ...overrides,
  };
}

function enterAmount(element: HTMLElement, digits: string): void {
  for (const digit of digits) {
    const key = element.querySelector<HTMLButtonElement>(`[data-keypad-key="${digit}"]`);
    if (!key) throw new Error(`keypad key missing: ${digit}`);
    key.click();
  }
}

describe('seller view', () => {
  it('asks for the seller only on first use', () => {
    const element = root();
    createSellerApp(element, config, createDependencies());

    expect(element.textContent).toContain('받는 분을 선택해 주세요');
    button(element, '사용자 1').click();

    expect(localStorage.getItem('qrpay.currentSeller')).toBe('1');
    expect(element.textContent).toContain('현재 받는 분');
    expect(element.textContent).toContain('사용자 1');
  });

  it('shows full receiving account and a large in-app keypad', () => {
    localStorage.setItem('qrpay.currentSeller', '1');
    const element = root();
    createSellerApp(element, config, createDependencies());

    expect(element.textContent).toContain('NH농협');
    expect(element.textContent).toContain('123-456-7890');
    expect(element.querySelectorAll('[data-keypad-key]')).toHaveLength(12);
    expect(element.querySelector('.app-header')).not.toBeNull();
    expect(element.querySelector('.amount-display')).not.toBeNull();
    expect(element.querySelector('.keypad')).not.toBeNull();
    expect(element.querySelector('.primary-action')).not.toBeNull();

    const createQr = button(element, 'QR 만들기');
    expect(createQr.disabled).toBe(true);
    enterAmount(element, '14000');
    expect(element.textContent).toContain('14,000원');
    expect(element.textContent).toContain('1만 4천원');
    expect(createQr.disabled).toBe(false);
  });

  it('rejects a non-thousand amount without losing the entered digits', () => {
    localStorage.setItem('qrpay.currentSeller', '1');
    const element = root();
    createSellerApp(element, config, createDependencies());

    enterAmount(element, '14500');
    expect(element.textContent).toContain('14,500원');
    expect(element.textContent).toContain('1,000원 단위로 입력해 주세요');
    expect(button(element, 'QR 만들기').disabled).toBe(true);
  });

  it('records QR creation and automatically resets after 15 seconds', async () => {
    localStorage.setItem('qrpay.currentSeller', '1');
    const element = root();
    let scheduled: (() => void) | undefined;
    let tick: (() => void) | undefined;
    const timers = {
      setTimeout: vi.fn((callback: () => void, delay: number) => {
        scheduled = callback;
        expect(delay).toBe(15_000);
        return 9;
      }),
      clearTimeout: vi.fn(),
      setInterval: vi.fn((callback: () => void, delay: number) => {
        tick = callback;
        expect(delay).toBe(1_000);
        return 10;
      }),
      clearInterval: vi.fn(),
    };
    const makeQr = vi.fn<(url: string) => Promise<string>>().mockResolvedValue('data:image/png;base64,qr');
    createSellerApp(element, config, createDependencies({ timers, makeQr }));

    enterAmount(element, '14000');
    button(element, 'QR 만들기').click();
    await vi.waitFor(() => expect(makeQr).toHaveBeenCalledOnce());

    expect(makeQr.mock.calls[0][0]).toBe('https://example.com/qr-pay/pay/?u=1&a=14000');
    expect(makeQr.mock.calls[0][0]).not.toContain('1234567890');
    expect(JSON.parse(localStorage.getItem('qrpay.sales') ?? '[]')).toHaveLength(1);
    expect(element.textContent).toContain('14,000원');
    expect(element.textContent).toContain('15초 후');
    tick?.();
    expect(element.textContent).toContain('14초 후');
    expect(timers.setTimeout).toHaveBeenCalledOnce();

    scheduled?.();
    expect(element.textContent).toContain('받을 금액을 입력해 주세요');
    expect(element.textContent).toContain('0원');
  });

  it('keeps records and seller change inside settings', () => {
    localStorage.setItem('qrpay.currentSeller', '1');
    localStorage.setItem(
      'qrpay.sales',
      JSON.stringify([
        { occurredAt: '2026-10-14T10:00:00+09:00', sellerId: '1', amount: 14_000 },
      ]),
    );
    const element = root();
    createSellerApp(element, config, createDependencies());

    expect(element.textContent).not.toContain('오늘 QR 1건');
    button(element, '설정').click();
    expect(element.textContent).toContain('오늘 QR 1건');
    expect(element.textContent).toContain('14,000원');
    expect(element.textContent).toContain('받는 분 바꾸기');
  });
});
