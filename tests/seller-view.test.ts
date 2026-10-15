import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLocalConfig, loadLocalConfig, saveLocalConfig } from '../src/lib/local-config';
import { parsePaymentRequest } from '../src/lib/pay-url';
import { createSellerApp } from '../src/seller/main';

function root() {
  const node = document.createElement('main');
  document.body.append(node);
  return node;
}

function button(element: ParentNode, text: string): HTMLButtonElement {
  const found = [...element.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button not found: ${text}`);
  return found;
}

function setValue(element: ParentNode, name: string, value: string) {
  const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(`[name=${name}]`);
  if (!input) throw new Error(`field not found: ${name}`);
  input.value = value;
}

function createDependencies(overrides: Record<string, unknown> = {}) {
  return {
    storage: localStorage,
    baseUrl: 'https://example.com/QR-pay/',
    makeQr: vi.fn<(url: string) => Promise<string>>().mockResolvedValue('data:image/png;base64,qr'),
    now: () => new Date('2026-10-15T12:00:00+09:00'),
    timers: {
      setTimeout: vi.fn((_callback: () => void, _delay: number) => 1),
      clearTimeout: vi.fn(),
      setInterval: vi.fn((_callback: () => void, _delay: number) => 2),
      clearInterval: vi.fn(),
    },
    ...overrides,
  };
}

function seed() {
  const result = createLocalConfig('김선비 벌꿀', {
    label: '장인어른', bank: 'NH농협은행', holder: '홍길동', accountDisplay: '123-456-7890',
  }, () => 'seller-a');
  if (!result.ok) throw new Error(result.message);
  saveLocalConfig(localStorage, result.value);
  localStorage.setItem('qrpay.currentSeller', 'seller-a');
  return result.value;
}

function fillSellerForm(element: ParentNode, values = {
  label: '장모님', bank: '신한은행', holder: '김영희', account: '987-654-3210',
}) {
  setValue(element, 'label', values.label);
  setValue(element, 'bank', values.bank);
  setValue(element, 'holder', values.holder);
  setValue(element, 'accountDisplay', values.account);
}

function quickAmount(element: ParentNode, amount: number): HTMLButtonElement {
  const found = [...element.querySelectorAll<HTMLButtonElement>('[data-quick-amount]')]
    .find((item) => item.dataset.quickAmount === String(amount));
  if (!found) throw new Error(`quick amount not found: ${amount}`);
  return found;
}

describe('seller app local setup', () => {
  it('includes the approved compact layout and short-screen rules', () => {
    const css = readFileSync(resolve(import.meta.dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toContain('.app-shell--compact');
    expect(css).toContain('@media (max-height: 700px)');
    expect(css).toContain('min-height: 48px');
  });

  it('starts with setup, saves the first recipient, then shows install help', () => {
    const element = root();
    createSellerApp(element, createDependencies());
    expect(element.textContent).toContain('처음 설정');
    setValue(element, 'shopName', '우리 가게');
    fillSellerForm(element, {
      label: '사장님', bank: 'KB국민은행', holder: '박사장', account: '111-222-333333',
    });
    button(element, '저장하고 시작하기').click();
    expect(loadLocalConfig(localStorage)?.shopName).toBe('우리 가게');
    expect(element.textContent).toContain('홈 화면에 설치');
    button(element, '금액 입력 시작').click();
    expect(element.textContent).toContain('받을 금액');
    expect(element.textContent).toContain('사장님');
  });

  it('prefers a selected known bank over a leftover custom bank value', () => {
    const element = root();
    createSellerApp(element, createDependencies());
    setValue(element, 'shopName', '우리 가게');
    fillSellerForm(element, {
      label: '사장님', bank: '신한은행', holder: '박사장', account: '111-222-333333',
    });
    setValue(element, 'customBank', '서산농협');
    button(element, '저장하고 시작하기').click();
    expect(loadLocalConfig(localStorage)?.sellers[0].bank).toBe('신한은행');
  });

  it('shows a compact amount screen with quick amounts and QR action', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    expect(element.querySelector('.app-shell--compact')).not.toBeNull();
    expect(element.querySelectorAll('[data-keypad-key]')).toHaveLength(12);
    quickAmount(element, 10_000).click();
    quickAmount(element, 5_000).click();
    expect(element.querySelector('[data-testid=amount-display]')?.textContent).toBe('15,000원');
    expect(button(element, 'QR 만들기').disabled).toBe(false);
  });

  it('builds a fragment QR containing the selected local recipient', async () => {
    seed();
    const element = root();
    const makeQr = vi.fn<(url: string) => Promise<string>>().mockResolvedValue('data:image/png;base64,qr');
    createSellerApp(element, createDependencies({ makeQr }));
    quickAmount(element, 1_000).click();
    button(element, 'QR 만들기').click();
    await vi.waitFor(() => expect(makeQr).toHaveBeenCalledOnce());
    const url = makeQr.mock.calls[0][0];
    expect(url.slice(0, url.indexOf('#'))).not.toContain('1234567890');
    const parsed = parsePaymentRequest(new URL(url).hash);
    expect(parsed.ok && parsed.seller.id).toBe('seller-a');
  });

  it('adds a recipient with an automatic different color', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    button(element, '설정').click();
    button(element, '받는 분 추가').click();
    fillSellerForm(element);
    button(element, '받는 분 저장').click();
    const config = loadLocalConfig(localStorage);
    expect(config?.sellers).toHaveLength(2);
    expect(config?.sellers[1]).toMatchObject({ label: '장모님', color: '#9A3412' });
  });

  it('edits the shop and recipient, then deletes with confirmation', () => {
    const initial = seed();
    const second = {
      ...initial,
      sellers: [...initial.sellers, {
        id: 'seller-b', label: '장모님', color: '#9A3412', bank: '신한은행', holder: '김영희',
        accountDisplay: '987-654-3210', accountCopy: '9876543210',
      }],
    };
    saveLocalConfig(localStorage, second);
    const element = root();
    createSellerApp(element, createDependencies());
    button(element, '설정').click();
    button(element, '판매점 이름 수정').click();
    setValue(element, 'shopName', '새 상호');
    button(element, '판매점 이름 저장').click();
    expect(loadLocalConfig(localStorage)?.shopName).toBe('새 상호');

    const card = element.querySelector<HTMLElement>('[data-seller-id=seller-b]');
    if (!card) throw new Error('seller card missing');
    button(card, '수정').click();
    setValue(element, 'label', '수정된 장모님');
    button(element, '받는 분 저장').click();
    expect(loadLocalConfig(localStorage)?.sellers[1].label).toBe('수정된 장모님');

    button(element.querySelector('[data-seller-id=seller-b]')!, '삭제').click();
    expect(element.textContent).toContain('정말 삭제');
    button(element, '삭제 확인').click();
    expect(loadLocalConfig(localStorage)?.sellers).toHaveLength(1);
  });

  it('does not allow deleting the final recipient', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    button(element, '설정').click();
    const remove = button(element, '삭제');
    expect(remove.disabled).toBe(true);
    expect(element.textContent).toContain('받는 분을 한 명 이상 유지');
  });
});
