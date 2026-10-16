import type { Seller } from '../config';
import { nonghyupKind, OTHER_BANKS, PRIMARY_BANKS, type BankOption } from '../lib/banks';
import { copyText } from '../lib/clipboard';
import { buildAndroidBankLink, buildIosTossLink, buildTossLink } from '../lib/deeplink';
import { formatWon, formatWonWords } from '../lib/money';
import { parsePaymentRequest } from '../lib/pay-url';
import { detectPlatform, type Platform } from '../lib/platform';
import { registerPwa } from '../pwa';
import '../styles.css';

type PayDependencies = {
  hash: string;
  copy: (text: string) => Promise<boolean>;
  open: (url: string) => void;
  pageUrl?: string;
  platform?: Platform;
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderError(root: HTMLElement, message: string): void {
  const view = element('section', 'pay-screen');
  const card = element('div', 'panel pay-error');
  card.append(
    element('p', 'error-symbol', '!'),
    element('h1', undefined, '송금 정보를 확인할 수 없어요'),
    element('p', 'body-text', message),
  );
  view.append(card);
  root.replaceChildren(view);
}

function accountCard(seller: Seller): HTMLElement {
  const account = element('dl', 'account-card account-panel');
  for (const [label, value] of [
    ['받는 은행', seller.bank], ['예금주', seller.holder], ['계좌번호', seller.accountDisplay],
  ] as const) {
    const row = element('div', 'account-row');
    row.append(element('dt', undefined, label), element('dd', undefined, value));
    account.append(row);
  }
  return account;
}

export function createPayApp(root: HTMLElement, dependencies: PayDependencies): void {
  const request = parsePaymentRequest(dependencies.hash);
  if (!request.ok) {
    renderError(root, request.message);
    return;
  }
  const { seller } = request;
  const view = element('section', 'pay-screen');
  const card = element('div', 'panel pay-card');
  card.style.setProperty('--seller-color', seller.color);
  card.append(
    element('p', 'app-kicker', request.shopName),
    element('p', 'pay-label', '보낼 금액'),
  );
  const amount = element('h1', 'pay-amount', formatWon(request.amount));
  amount.dataset.testid = 'pay-amount';
  card.append(amount, element('p', 'amount-words', formatWonWords(request.amount)), accountCard(seller));

  const copyStatus = element(
    'p', 'copy-status',
    '은행 앱을 누르면 계좌번호가 먼저 복사됩니다. 앱이 열리지 않으면 직접 앱을 열어 붙여넣으세요.',
  );
  copyStatus.setAttribute('role', 'status');
  const isIos = dependencies.platform === 'ios';

  const launchLink = (bank: BankOption): string | null => {
    if (bank.kind === 'toss') {
      const payment = { bank: seller.bank, accountNo: seller.accountCopy, amount: request.amount };
      return isIos
        ? buildIosTossLink(payment)
        : buildTossLink(payment, dependencies.pageUrl ?? 'https://example.invalid/');
    }
    return isIos ? null : buildAndroidBankLink(bank);
  };

  const openBank = async (bank: BankOption): Promise<void> => {
    const copyOperation = dependencies.copy(seller.accountCopy);
    const link = launchLink(bank);
    let launchFailed = false;
    if (link) {
      try { dependencies.open(link); } catch { launchFailed = true; }
    }
    const copied = await copyOperation;
    if (launchFailed) {
      copyStatus.textContent = '앱을 열지 못했습니다. 계좌번호를 복사했으니 은행 앱을 직접 열어 주세요.';
      copyStatus.className = 'copy-status copy-status--error';
      return;
    }
    if (!copied) {
      copyStatus.textContent = '자동 복사가 되지 않았습니다. 위 계좌번호를 길게 눌러 복사해 주세요.';
      copyStatus.className = 'copy-status copy-status--error';
      return;
    }
    if (bank.kind === 'toss') {
      copyStatus.textContent = '계좌번호를 복사했습니다. 토스에서 받는 분과 금액을 확인하세요.';
    } else if (link) {
      copyStatus.textContent = `계좌번호를 복사했습니다. ${bank.label} 앱에서 붙여넣고 금액을 입력하세요.`;
    } else {
      copyStatus.textContent = `계좌번호를 복사했습니다. ${bank.label} 앱을 직접 열어 붙여넣고 ${formatWon(request.amount)}을 입력하세요.`;
    }
    copyStatus.className = 'copy-status copy-status--success';
  };

  const bankSection = element('section', 'bank-section');
  bankSection.append(
    element('h2', 'bank-title', '사용할 은행 앱을 선택하세요'),
    element('p', 'bank-help', '마지막 송금 전 받는 분과 금액을 확인하세요.'),
  );
  const bankGrid = element('div', 'bank-grid');
  for (const bank of [...PRIMARY_BANKS, ...OTHER_BANKS]) {
    const button = element('button', `bank-button bank-button--${bank.id}`, bank.label);
    button.type = 'button';
    button.dataset.bankId = bank.id;
    button.setAttribute('aria-label', `${bank.label} 앱 열기`);
    button.addEventListener('click', () => void openBank(bank));
    bankGrid.append(button);
  }
  bankSection.append(bankGrid, copyStatus);

  const steps = element('aside', 'manual-steps');
  steps.append(
    element('h2', undefined, '직접 송금하려면'),
    element('p', undefined, nonghyupKind(seller.bank) === 'local'
      ? '1. 받는 은행에서 지역농·축협을 선택하세요. 목록에 없으면 농협을 선택하세요.'
      : `1. 받는 은행에서 ${seller.bank}을 선택하세요.`),
    element('p', undefined, '2. 복사한 계좌번호를 붙여넣으세요.'),
    element('p', 'manual-amount', `3. ${formatWon(request.amount)}을 입력하고 받는 분을 확인하세요.`),
  );
  const copyOnly = element('button', 'button button--text', '계좌번호만 다시 복사');
  copyOnly.type = 'button';
  copyOnly.addEventListener('click', async () => {
    const copied = await dependencies.copy(seller.accountCopy);
    copyStatus.textContent = copied ? '계좌번호를 복사했습니다.' : '복사되지 않았습니다. 계좌번호를 길게 눌러 복사해 주세요.';
    copyStatus.className = copied ? 'copy-status copy-status--success' : 'copy-status copy-status--error';
  });
  card.append(bankSection, steps, copyOnly);
  view.append(card);
  root.replaceChildren(view);
}

const mount = document.querySelector<HTMLElement>('[data-pay-app]');
if (mount) {
  void registerPwa(navigator, new URL('../', document.baseURI).toString());
  createPayApp(mount, {
    hash: window.location.hash,
    copy: (value) => copyText(value),
    open: (url) => { window.location.href = url; },
    pageUrl: window.location.href,
    platform: detectPlatform(navigator),
  });
}
