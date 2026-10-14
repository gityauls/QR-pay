import { getSeller, readAppConfig, type AppConfig, type Seller } from '../config';
import { OTHER_BANKS, PRIMARY_BANKS, type BankOption } from '../lib/banks';
import { copyText } from '../lib/clipboard';
import { buildAndroidBankLink, buildTossLink } from '../lib/deeplink';
import { formatWon, formatWonWords } from '../lib/money';
import { parsePaymentRequest } from '../lib/pay-url';
import '../styles.css';

type PayDependencies = {
  search: string;
  copy: (text: string) => Promise<boolean>;
  open: (url: string) => void;
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
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
    ['받는 은행', seller.bank],
    ['예금주', seller.holder],
    ['계좌번호', seller.accountDisplay],
  ] as const) {
    const row = element('div', 'account-row');
    row.append(element('dt', undefined, label), element('dd', undefined, value));
    account.append(row);
  }
  return account;
}

export function createPayApp(
  root: HTMLElement,
  config: AppConfig,
  dependencies: PayDependencies,
): void {
  const request = parsePaymentRequest(dependencies.search);
  if (!request.ok) {
    renderError(root, request.message);
    return;
  }

  const seller = getSeller(config, request.sellerId);
  if (!seller) {
    renderError(root, '받는 분의 계좌를 찾을 수 없습니다. 판매자에게 새 QR을 요청해 주세요.');
    return;
  }

  const view = element('section', 'pay-screen');
  const card = element('div', 'panel pay-card');
  card.style.setProperty('--seller-color', seller.color);
  card.append(
    element('p', 'app-kicker', config.shopName),
    element('p', 'pay-label', '보낼 금액'),
  );

  const amount = element('h1', 'pay-amount', formatWon(request.amount));
  amount.dataset.testid = 'pay-amount';
  card.append(
    amount,
    element('p', 'amount-words', formatWonWords(request.amount)),
    accountCard(seller),
  );

  const copyStatus = element('p', 'copy-status', '은행 앱을 누르면 계좌번호가 먼저 복사됩니다.');
  copyStatus.setAttribute('role', 'status');

  const openBank = async (bank: BankOption): Promise<void> => {
    const copied = await dependencies.copy(seller.accountCopy);
    if (copied) {
      copyStatus.textContent = bank.kind === 'toss'
        ? '계좌번호를 복사했습니다. 토스에서 받는 분과 금액을 확인하세요.'
        : `계좌번호를 복사했습니다. ${bank.label} 앱에서 붙여넣고 금액을 입력하세요.`;
      copyStatus.className = 'copy-status copy-status--success';
    } else {
      copyStatus.textContent = '자동 복사가 되지 않았습니다. 위 계좌번호를 길게 눌러 복사해 주세요.';
      copyStatus.className = 'copy-status copy-status--error';
    }

    const link = bank.kind === 'toss'
      ? buildTossLink({ bank: seller.bank, accountNo: seller.accountCopy, amount: request.amount })
      : buildAndroidBankLink(bank);
    dependencies.open(link);
  };

  const bankSection = element('section', 'bank-section');
  bankSection.append(
    element('h2', 'bank-title', '사용할 은행 앱을 선택하세요'),
    element('p', 'bank-help', '고객님이 송금할 때 쓰는 은행을 누르세요.'),
  );

  const bankGrid = element('div', 'bank-grid');
  const appendBanks = (banks: readonly BankOption[]) => {
    for (const bank of banks) {
      const button = element('button', `bank-button bank-button--${bank.id}`, bank.label);
      button.type = 'button';
      button.dataset.bankId = bank.id;
      button.setAttribute('aria-label', `${bank.label} 앱 열기`);
      button.addEventListener('click', () => void openBank(bank));
      bankGrid.append(button);
    }
  };
  appendBanks(PRIMARY_BANKS);

  const moreButton = element('button', 'button button--secondary more-banks', '다른 은행 보기');
  moreButton.type = 'button';
  moreButton.setAttribute('aria-expanded', 'false');
  moreButton.addEventListener('click', () => {
    appendBanks(OTHER_BANKS);
    moreButton.setAttribute('aria-expanded', 'true');
    moreButton.remove();
  });
  bankSection.append(bankGrid, moreButton, copyStatus);

  const steps = element('aside', 'manual-steps');
  steps.append(
    element('h2', undefined, '은행 앱이 열리면'),
    element('p', undefined, `1. 받는 은행에서 ${seller.bank}을 선택하세요.`),
    element('p', undefined, '2. 복사된 계좌번호를 붙여넣으세요.'),
    element('p', 'manual-amount', `3. ${formatWon(request.amount)}을 입력하고 받는 분을 확인하세요.`),
  );

  const copyOnly = element('button', 'button button--text', '계좌번호만 다시 복사');
  copyOnly.type = 'button';
  copyOnly.addEventListener('click', async () => {
    const copied = await dependencies.copy(seller.accountCopy);
    copyStatus.textContent = copied
      ? '계좌번호를 복사했습니다.'
      : '복사되지 않았습니다. 계좌번호를 길게 눌러 복사해 주세요.';
    copyStatus.className = copied ? 'copy-status copy-status--success' : 'copy-status copy-status--error';
  });

  card.append(bankSection, steps, copyOnly);
  view.append(card);
  root.replaceChildren(view);
}

const mount = document.querySelector<HTMLElement>('[data-pay-app]');
if (mount) {
  const config = readAppConfig();
  if (!config.ok) renderError(mount, config.message);
  else {
    createPayApp(mount, config.value, {
      search: window.location.search,
      copy: (value) => copyText(value),
      open: (url) => {
        window.location.href = url;
      },
    });
  }
}
