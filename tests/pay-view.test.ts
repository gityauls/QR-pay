import { describe, expect, it, vi } from 'vitest';
import type { Seller } from '../src/config';
import { buildPayUrl } from '../src/lib/pay-url';
import { createPayApp } from '../src/pay/main';

const seller: Seller = {
  id: 'seller-2', label: '장모님', color: '#9A3412', bank: '신한은행', holder: '김영희',
  accountDisplay: '987-654-3210', accountCopy: '9876543210',
};

function root() {
  const node = document.createElement('main');
  document.body.append(node);
  return node;
}

function paymentHash(recipient = seller, amount = 45_000) {
  return new URL(buildPayUrl('https://example.com/QR-pay/', '행사 판매점', recipient, amount)).hash;
}

describe('customer payment view', () => {
  it.each(['', '#broken'])('blocks an invalid QR request %s', (hash) => {
    const node = root();
    createPayApp(node, { hash, copy: vi.fn(), open: vi.fn() });
    expect(node.textContent).toContain('이 QR로는 송금할 수 없습니다');
    expect(node.querySelector('button')).toBeNull();
  });

  it('shows the exact local recipient and payment amount', () => {
    const node = root();
    createPayApp(node, {
      hash: paymentHash(), copy: vi.fn(), open: vi.fn(),
      pageUrl: 'https://example.com/QR-pay/pay/#payload',
    });
    expect(node.textContent).toContain('행사 판매점');
    expect(node.textContent).toContain('45,000원');
    expect(node.textContent).toContain('신한은행');
    expect(node.textContent).toContain('김영희');
    expect(node.textContent).toContain('987-654-3210');
    expect(node.querySelector('.bank-grid')).not.toBeNull();
  });

  it('copies the account before opening a general Android bank app', async () => {
    const node = root();
    const copy = vi.fn(async () => true);
    const open = vi.fn();
    createPayApp(node, { hash: paymentHash(), copy, open });
    node.querySelector<HTMLButtonElement>('[data-bank-id=nh]')?.click();
    await vi.waitFor(() => expect(copy).toHaveBeenCalledWith('9876543210'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('package=nh.smart.banking'));
    expect(node.textContent).toContain('계좌번호를 복사했습니다');
  });

  it('opens Toss with the amount on Android', async () => {
    const node = root();
    const open = vi.fn();
    createPayApp(node, { hash: paymentHash(), copy: vi.fn(async () => true), open });
    node.querySelector<HTMLButtonElement>('[data-bank-id=toss]')?.click();
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^intent:\/\/send\?/));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('amount=45000'));
  });

  it('opens Toss with the amount through the iPhone scheme', async () => {
    const node = root();
    const open = vi.fn();
    createPayApp(node, {
      hash: paymentHash(), copy: vi.fn(async () => true), open, platform: 'ios',
    });
    node.querySelector<HTMLButtonElement>('[data-bank-id=toss]')?.click();
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^supertoss:\/\/send\?/));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('amount=45000'));
  });

  it('copies without opening an unsupported iPhone bank link', async () => {
    const node = root();
    const copy = vi.fn(async () => true);
    const open = vi.fn();
    createPayApp(node, { hash: paymentHash(), copy, open, platform: 'ios' });
    node.querySelector<HTMLButtonElement>('[data-bank-id=nh]')?.click();
    await vi.waitFor(() => expect(node.textContent).toContain('NH농협 앱을 직접 열어'));
    expect(copy).toHaveBeenCalledWith('9876543210');
    expect(open).not.toHaveBeenCalled();
    expect(node.textContent).toContain('45,000원을 입력하세요');
  });

  it('explains how to find a local cooperative account', () => {
    const local = { ...seller, bank: '서산농협' };
    const node = root();
    createPayApp(node, { hash: paymentHash(local, 14_000), copy: vi.fn(), open: vi.fn() });
    expect(node.textContent).toContain('지역농·축협을 선택하세요');
  });

  it('keeps a manual path when app launch throws', async () => {
    const node = root();
    createPayApp(node, {
      hash: paymentHash(), copy: vi.fn(async () => true),
      open: vi.fn(() => { throw new Error('unsupported scheme'); }),
    });
    node.querySelector<HTMLButtonElement>('[data-bank-id=toss]')?.click();
    await vi.waitFor(() => expect(node.textContent).toContain('앱을 열지 못했습니다'));
  });
});
