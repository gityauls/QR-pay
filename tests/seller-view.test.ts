import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLocalConfig, loadLocalConfig, saveLocalConfig } from '../src/lib/local-config';
import type { ListenResult } from '../src/lib/speech';
import { getSales } from '../src/lib/storage';
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

  it('fills the phone height while keeping elderly-friendly keypad spacing', () => {
    const css = readFileSync(resolve(import.meta.dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.app-shell--compact\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
    expect(css).toMatch(/\.app-shell--compact \.amount-panel\s*\{[^}]*display:\s*flex[^}]*flex:\s*1/s);
    expect(css).toMatch(/\.app-shell--compact \.keypad\s*\{[^}]*flex:\s*1[^}]*gap:\s*var\(--key-gap\)/s);
    expect(css).toMatch(/--key-gap:\s*8px/);
    expect(css).toContain('grid-template-rows: repeat(4, minmax(48px, 1fr))');
    expect(css).not.toContain('min-height: 42px');
  });

  it('starts with setup when opened from the home screen, then goes straight to amount entry', () => {
    const element = root();
    createSellerApp(element, createDependencies());
    expect(element.textContent).toContain('처음 설정');
    setValue(element, 'shopName', '우리 가게');
    fillSellerForm(element, {
      label: '사장님', bank: 'KB국민은행', holder: '박사장', account: '111-222-333333',
    });
    button(element, '저장하고 시작하기').click();
    expect(loadLocalConfig(localStorage)?.shopName).toBe('우리 가게');
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
  it('puts the bank and account beside the recipient name', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    const header = element.querySelector('.app-header');
    expect(header?.querySelector('.app-header__who')?.textContent).toContain('장인어른');
    expect(header?.querySelector('.app-header__bank')?.textContent).toBe('NH농협은행');
    expect(header?.querySelector('.app-header__number')?.textContent).toBe('123-456-7890');
  });

  it('shows keypad utilities on two lines and digits in a sizeable label', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    const clear = element.querySelector<HTMLElement>('[data-keypad-key=clear]');
    expect(clear?.querySelectorAll('.keypad__line')).toHaveLength(2);
    expect(clear?.getAttribute('aria-label')).toBe('전체 지우기');
    expect(element.querySelector('[data-keypad-key="1"] .keypad__label')?.textContent).toBe('1');
  });
});

function fakeInstall(canPrompt: boolean, outcome: 'accepted' | 'dismissed' = 'accepted') {
  let available = canPrompt;
  return {
    canPrompt: () => available,
    installed: () => false,
    prompt: vi.fn(async () => {
      if (!available) return 'unavailable' as const;
      available = false;
      return outcome;
    }),
    onChange: vi.fn(() => () => undefined),
  };
}

describe('seller app installation', () => {
  it('offers installation first in a browser tab and lets the seller skip it', () => {
    const element = root();
    createSellerApp(element, createDependencies({ standalone: false, install: fakeInstall(false) }));
    expect(element.textContent).toContain('휴대폰에 설치하기');
    button(element, '설치하지 않고').click();
    expect(element.textContent).toContain('처음 설정');
  });

  it('shows the browser install prompt and then explains how to open the app', async () => {
    const element = root();
    const install = fakeInstall(true, 'accepted');
    createSellerApp(element, createDependencies({ standalone: false, install }));
    button(element, '휴대폰에 설치하기').click();
    await vi.waitFor(() => expect(element.textContent).toContain('설치됐어요'));
    expect(install.prompt).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('QR 송금');
    button(element, '여기서 바로 시작하기').click();
    expect(element.textContent).toContain('처음 설정');
  });

  it('keeps the install screen when the seller cancels the prompt', async () => {
    const element = root();
    createSellerApp(element, createDependencies({ standalone: false, install: fakeInstall(true, 'dismissed') }));
    button(element, '휴대폰에 설치하기').click();
    await vi.waitFor(() => expect(element.textContent).toContain('설치를 취소했어요'));
  });

  it('shows menu steps when the browser cannot prompt', async () => {
    const element = root();
    createSellerApp(element, createDependencies({ standalone: false, install: fakeInstall(false), browser: 'samsung' }));
    button(element, '휴대폰에 설치하기').click();
    await vi.waitFor(() => expect(element.textContent).toContain('현재 페이지 추가'));
  });

  it('shows iPhone home-screen steps instead of an install button', () => {
    const element = root();
    createSellerApp(element, createDependencies({ standalone: false, platform: 'ios', install: fakeInstall(false) }));
    expect(element.textContent).toContain('홈 화면에 추가');
    expect(element.textContent).toContain('공유');
    expect([...element.querySelectorAll('button')].some((item) => item.textContent === '휴대폰에 설치하기')).toBe(false);
  });

  it('opens Chrome straight from KakaoTalk on Android', () => {
    const element = root();
    const open = vi.fn();
    createSellerApp(element, createDependencies({ standalone: false, inApp: 'kakao', open }));
    expect(open).toHaveBeenCalledWith('intent://example.com/QR-pay/#Intent;scheme=https;package=com.android.chrome;end');
    expect(element.textContent).toContain('카카오톡');
    button(element, '크롬으로 열기').click();
    expect(open).toHaveBeenCalledTimes(2);
    button(element, '다른 인터넷 앱으로 열기').click();
    expect(open).toHaveBeenLastCalledWith('kakaotalk://web/openExternal?url=https%3A%2F%2Fexample.com%2FQR-pay%2F');
  });

  it('asks KakaoTalk to open Safari on iPhone', () => {
    const element = root();
    const open = vi.fn();
    createSellerApp(element, createDependencies({ standalone: false, inApp: 'kakao', platform: 'ios', open }));
    expect(open).toHaveBeenCalledWith('kakaotalk://web/openExternal?url=https%3A%2F%2Fexample.com%2FQR-pay%2F');
    button(element, '인터넷 앱으로 열기').click();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('opens Chrome from other Android in-app browsers on request', () => {
    const element = root();
    const open = vi.fn();
    createSellerApp(element, createDependencies({ standalone: false, inApp: 'webview', open }));
    expect(open).not.toHaveBeenCalled();
    button(element, '크롬으로 열기').click();
    expect(open).toHaveBeenCalledWith('intent://example.com/QR-pay/#Intent;scheme=https;package=com.android.chrome;end');
  });

  it('shares the app link from settings', async () => {
    seed();
    const element = root();
    const share = vi.fn(async (_data: ShareData) => 'shared' as const);
    createSellerApp(element, createDependencies({ share }));
    button(element, '설정').click();
    button(element, '다른 분께 앱 보내기').click();
    await vi.waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share.mock.calls[0][0]).toMatchObject({ url: 'https://example.com/QR-pay/' });
  });

  it('copies the app link when the phone cannot share', async () => {
    seed();
    const element = root();
    const copy = vi.fn(async () => true);
    createSellerApp(element, createDependencies({ share: vi.fn(async () => 'unsupported' as const), copy }));
    button(element, '설정').click();
    button(element, '다른 분께 앱 보내기').click();
    await vi.waitFor(() => expect(element.textContent).toContain('링크를 복사했어요'));
    expect(copy).toHaveBeenCalledWith('https://example.com/QR-pay/');
  });

  it('offers installation from settings when running in a browser tab', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies({ standalone: false, install: fakeInstall(false) }));
    expect(element.textContent).toContain('받을 금액');
    button(element, '설정').click();
    button(element, '휴대폰에 설치하기').click();
    expect(element.querySelector('.install-panel')).not.toBeNull();
  });
});

function listenWith(...results: ListenResult[]) {
  const queue = [...results];
  return vi.fn(async () => queue.shift() ?? { ok: false as const, reason: 'no-speech' as const });
}

function amountText(element: ParentNode) {
  return element.querySelector('[data-testid=amount-display]')?.textContent;
}

describe('seller app voice amount', () => {
  it('hides the voice button where speech recognition is unavailable', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    expect(element.querySelector('.voice-button')).toBeNull();
  });

  it('fills the amount from speech and lets the seller say it again', async () => {
    seed();
    const element = root();
    const listen = listenWith(
      { ok: true, transcripts: ['만오천원'] },
      { ok: true, transcripts: ['만육천원'] },
    );
    createSellerApp(element, createDependencies({ listen }));
    button(element, '말로 입력').click();
    await vi.waitFor(() => expect(amountText(element)).toBe('15,000원'));
    expect(element.textContent).toContain('만오천원');
    expect(button(element, 'QR 만들기').disabled).toBe(false);
    button(element, '말로 입력').click();
    await vi.waitFor(() => expect(amountText(element)).toBe('16,000원'));
    expect(listen).toHaveBeenCalledTimes(2);
  });

  it('uses the first alternative that is a price', async () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies({
      listen: listenWith({ ok: true, transcripts: ['맘 오천 원', '만 오천 원'] }),
    }));
    button(element, '말로 입력').click();
    await vi.waitFor(() => expect(amountText(element)).toBe('15,000원'));
  });

  it('asks again when the words are not a price', async () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies({ listen: listenWith({ ok: true, transcripts: ['안녕하세요'] }) }));
    button(element, '말로 입력').click();
    await vi.waitFor(() => expect(element.textContent).toContain('알아듣지 못했어요'));
    expect(amountText(element)).toBe('0원');
  });

  it('refuses a 100-won amount while 1,000-won steps are on', async () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies({ listen: listenWith({ ok: true, transcripts: ['만오천오백원'] }) }));
    button(element, '말로 입력').click();
    await vi.waitFor(() => expect(element.textContent).toContain('1,000원 단위로'));
    expect(amountText(element)).toBe('0원');
  });

  it('explains a blocked microphone', async () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies({ listen: listenWith({ ok: false, reason: 'denied' }) }));
    button(element, '말로 입력').click();
    await vi.waitFor(() => expect(element.textContent).toContain('마이크'));
  });
});

describe('seller app QR replay', () => {
  it('restarts the 15-second countdown without recording another sale', async () => {
    seed();
    const element = root();
    const dependencies = createDependencies();
    createSellerApp(element, dependencies);
    quickAmount(element, 5_000).click();
    button(element, 'QR 만들기').click();
    await vi.waitFor(() => expect(element.querySelector('.qr-image')).not.toBeNull());
    const tick = dependencies.timers.setInterval.mock.calls[0][0];
    tick();
    tick();
    expect(element.textContent).toContain('13초 뒤');
    button(element, 'QR 코드 다시 보기').click();
    expect(element.textContent).toContain('15초 뒤');
    expect(dependencies.timers.clearTimeout).toHaveBeenCalled();
    expect(dependencies.timers.setTimeout).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.qr-image')).not.toBeNull();
    expect(getSales(localStorage)).toHaveLength(1);
  });
});

describe('seller app 100-won steps', () => {
  function typeDigits(element: ParentNode, digits: string) {
    for (const digit of digits) element.querySelector<HTMLButtonElement>(`[data-keypad-key="${digit}"]`)?.click();
  }

  it('keeps 1,000-won steps by default', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    typeDigits(element, '15500');
    expect(button(element, 'QR 만들기').disabled).toBe(true);
  });

  it('allows 100-won prices after the setting is turned on', () => {
    seed();
    const element = root();
    createSellerApp(element, createDependencies());
    button(element, '설정').click();
    const toggle = element.querySelector<HTMLButtonElement>('[role=switch]');
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
    expect(toggle?.textContent).toContain('100원 단위 가격 입력');
    toggle?.click();
    expect(element.querySelector('[role=switch]')?.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('qrpay.amountStep')).toBe('100');
    button(element, '금액 입력으로 돌아가기').click();
    expect(element.textContent).toContain('100원 단위');
    typeDigits(element, '15500');
    expect(amountText(element)).toBe('15,500원');
    expect(button(element, 'QR 만들기').disabled).toBe(false);
  });
});
