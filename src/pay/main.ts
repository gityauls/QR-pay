import { getSeller, readAppConfig, type AppConfig } from '../config';
import { copyText } from '../lib/clipboard';
import { formatWon, formatWonWords } from '../lib/money';
import { parsePaymentRequest } from '../lib/pay-url';
import '../styles.css';

type PayDependencies = {
  search: string;
  copy: (text: string) => Promise<boolean>;
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
  const card = element('div', 'content-card pay-error');
  card.append(
    element('p', 'error-symbol', '!'),
    element('h1', undefined, '송금 정보를 확인할 수 없어요'),
    element('p', 'lead', message),
  );
  view.append(card);
  root.replaceChildren(view);
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
  const card = element('div', 'content-card pay-card');
  card.append(
    element('p', 'eyebrow', config.shopName),
    element('p', 'pay-label', '보낼 금액'),
  );

  const amount = element('h1', 'pay-amount', formatWon(request.amount));
  amount.dataset.testid = 'pay-amount';
  card.append(amount, element('p', 'amount-words', `(${formatWonWords(request.amount)})`));

  const account = element('dl', 'account-card');
  for (const [label, value] of [
    ['은행', seller.bank],
    ['예금주', seller.holder],
    ['계좌번호', seller.accountDisplay],
  ] as const) {
    const row = element('div', 'account-row');
    row.append(element('dt', undefined, label), element('dd', undefined, value));
    account.append(row);
  }
  card.append(account);

  const copyButton = element('button', 'button button--primary button--main', '계좌번호 복사');
  copyButton.type = 'button';
  const copyStatus = element('p', 'copy-status', '');
  copyStatus.setAttribute('role', 'status');
  copyButton.addEventListener('click', async () => {
    const copied = await dependencies.copy(seller.accountCopy);
    copyStatus.textContent = copied
      ? '계좌번호가 복사됐어요.'
      : '자동 복사가 안 됐어요. 위 계좌번호를 길게 눌러 복사해 주세요.';
    copyStatus.className = copied ? 'copy-status copy-status--success' : 'copy-status copy-status--error';
  });

  const steps = element('div', 'manual-steps');
  steps.append(
    element('h2', undefined, '이제 이렇게 보내세요'),
    element('p', undefined, '1. 계좌번호 복사를 누르세요.'),
    element('p', undefined, '2. 사용하시는 은행 앱을 직접 열어 붙여넣으세요.'),
    element('p', 'manual-amount', `3. 금액 ${formatWon(request.amount)}을 입력하세요.`),
    element('p', undefined, '4. 은행 앱에 표시된 예금주를 다시 확인하고 송금하세요.'),
  );

  card.append(copyButton, copyStatus, steps);
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
    });
  }
}
