import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config';
import { createPayApp } from '../src/pay/main';

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

describe('customer payment view', () => {
  it.each(['?a=100', '?u=3&a=100', '?u=1&a=99'])(
    'blocks an invalid QR request %s',
    (search) => {
      const element = root();
      createPayApp(element, config, { search, copy: vi.fn() });
      expect(element.textContent).toContain('이 QR로는 송금할 수 없습니다');
      expect(element.querySelector('button')).toBeNull();
    },
  );

  it('renders the exact user, full holder, account, and largest amount', () => {
    const element = root();
    createPayApp(element, config, { search: '?u=2&a=45000', copy: vi.fn() });

    expect(element.textContent).toContain('45,000원');
    expect(element.textContent).toContain('둘째은행');
    expect(element.textContent).toContain('김영희');
    expect(element.textContent).toContain('987-654-3210');
    expect(element.querySelector('[data-testid="pay-amount"]')?.textContent).toBe('45,000원');
  });

  it('copies the numeric account and explains the manual bank flow', async () => {
    const element = root();
    const copy = vi.fn(async () => true);
    createPayApp(element, config, { search: '?u=1&a=1000', copy });

    const copyButton = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('계좌번호 복사'),
    );
    if (!(copyButton instanceof HTMLButtonElement)) throw new Error('copy button missing');
    copyButton.click();

    await vi.waitFor(() => expect(copy).toHaveBeenCalledWith('1234567890'));
    expect(element.textContent).toContain('복사됐어요');
    expect(element.textContent).toContain('은행 앱을 직접 열어');
    expect(element.textContent).toContain('1,000원을 입력');
  });
});
