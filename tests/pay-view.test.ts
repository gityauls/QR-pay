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
      bank: '농협은행',
      holder: '홍길동',
      accountDisplay: '123-456-7890',
      accountCopy: '1234567890',
    },
    {
      id: '2',
      label: '사용자 2',
      color: '#9A3412',
      bank: '국민은행',
      holder: '김영희',
      accountDisplay: '987-654-3210',
      accountCopy: '9876543210',
    },
  ],
};

function root() {
  const node = document.createElement('main');
  document.body.append(node);
  return node;
}

describe('customer payment view', () => {
  it.each(['?a=1000', '?u=3&a=1000', '?u=1&a=14500'])(
    'blocks an invalid QR request %s',
    (search) => {
      const node = root();
      createPayApp(node, config, { search, copy: vi.fn(), open: vi.fn() });
      expect(node.textContent).toContain('이 QR로는 송금할 수 없습니다');
      expect(node.querySelector('button')).toBeNull();
    },
  );

  it('shows the exact recipient and payment amount', () => {
    const node = root();
    createPayApp(node, config, {
      search: '?u=2&a=45000',
      copy: vi.fn(),
      open: vi.fn(),
    });

    expect(node.textContent).toContain('45,000원');
    expect(node.textContent).toContain('국민은행');
    expect(node.textContent).toContain('김영희');
    expect(node.textContent).toContain('987-654-3210');
    expect(node.querySelector('[data-testid="pay-amount"]')?.textContent).toBe('45,000원');
  });

  it('shows primary banks before the expandable additional list', () => {
    const node = root();
    createPayApp(node, config, {
      search: '?u=1&a=14000',
      copy: vi.fn(),
      open: vi.fn(),
    });

    expect(node.querySelectorAll('[data-bank-id]').length).toBe(8);
    expect(node.textContent).toContain('NH농협');
    expect(node.textContent).toContain('토스');
    expect(node.textContent).toContain('다른 은행 보기');

    const more = [...node.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('다른 은행 보기'),
    );
    more?.click();
    expect(node.querySelectorAll('[data-bank-id]').length).toBeGreaterThan(8);
    expect(node.textContent).toContain('새마을금고');
  });

  it('copies the account before opening a general bank app', async () => {
    const node = root();
    const copy = vi.fn(async () => true);
    const open = vi.fn();
    createPayApp(node, config, { search: '?u=1&a=14000', copy, open });

    const bankButton = node.querySelector<HTMLButtonElement>('[data-bank-id="nh"]');
    bankButton?.click();

    await vi.waitFor(() => expect(copy).toHaveBeenCalledWith('1234567890'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('package=nh.smart.banking'));
    expect(node.textContent).toContain('계좌번호를 복사했습니다');
  });

  it('uses the Toss amount link while retaining the copied account fallback', async () => {
    const node = root();
    const copy = vi.fn(async () => true);
    const open = vi.fn();
    createPayApp(node, config, { search: '?u=2&a=45000', copy, open });

    const tossButton = node.querySelector<HTMLButtonElement>('[data-bank-id="toss"]');
    tossButton?.click();

    await vi.waitFor(() => expect(copy).toHaveBeenCalledWith('9876543210'));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^supertoss:\/\/send\?/));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('amount=45000'));
  });
});
