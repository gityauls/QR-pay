import QRCode from 'qrcode';
import { getSeller, readAppConfig, type AppConfig, type Seller } from '../config';
import { formatWon, formatWonWords, parseAmount } from '../lib/money';
import { buildPayUrl } from '../lib/pay-url';
import {
  getSales,
  getTodaySummary,
  loadCurrentSeller,
  recordSale,
  saveCurrentSeller,
  type StorageLike,
} from '../lib/storage';
import '../styles.css';

type SellerDependencies = {
  storage: StorageLike;
  baseUrl: string;
  makeQr: (url: string) => Promise<string>;
  now: () => Date;
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

function action(text: string, className = 'button'): HTMLButtonElement {
  const node = element('button', className, text);
  node.type = 'button';
  return node;
}

function defaultMakeQr(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 720,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export function createSellerApp(
  root: HTMLElement,
  config: AppConfig,
  dependencies: SellerDependencies,
): void {
  let currentSellerId = loadCurrentSeller(dependencies.storage);
  let amount: number | null = null;
  let notice = '';

  const seller = (): Seller | null => getSeller(config, currentSellerId);

  function replace(view: HTMLElement): void {
    root.replaceChildren(view);
  }

  function sellerBanner(current: Seller): HTMLElement {
    const banner = element('header', 'seller-banner');
    banner.style.setProperty('--seller-color', current.color);
    banner.append(
      element('strong', 'seller-banner__title', `${current.label} 계좌로 받는 중`),
      element('span', 'seller-banner__bank', current.bank),
    );
    return banner;
  }

  function renderChoice(): void {
    const view = element('section', 'screen screen--choice');
    view.append(
      element('p', 'eyebrow', config.shopName),
      element('h1', undefined, '누가 받으시나요?'),
      element('p', 'lead', '입금 알림을 확인할 분을 눌러 주세요.'),
    );

    const choices = element('div', 'seller-choices');
    for (const candidate of config.sellers) {
      const choose = action(
        `${candidate.label}\n${candidate.bank} 계좌로 받기`,
        'seller-choice',
      );
      choose.style.setProperty('--seller-color', candidate.color);
      choose.addEventListener('click', () => {
        currentSellerId = candidate.id;
        saveCurrentSeller(dependencies.storage, candidate.id);
        amount = null;
        renderAmount();
      });
      choices.append(choose);
    }
    view.append(choices);
    replace(view);
  }

  function renderAmount(): void {
    const current = seller();
    if (!current) {
      currentSellerId = null;
      renderChoice();
      return;
    }

    const view = element('section', 'screen');
    view.append(sellerBanner(current));

    const topActions = element('div', 'top-actions');
    const changeSeller = action('받는 분 바꾸기', 'button button--quiet');
    changeSeller.addEventListener('click', () => {
      currentSellerId = null;
      amount = null;
      renderChoice();
    });
    const showRecords = action('기록 보기', 'button button--quiet');
    showRecords.addEventListener('click', renderRecords);
    topActions.append(changeSeller, showRecords);
    view.append(topActions);

    const content = element('div', 'content-card amount-card');
    content.append(
      element('p', 'eyebrow', config.shopName),
      element('h1', undefined, '받을 금액'),
      element('p', 'lead', '손님에게 받을 최종 금액을 입력하세요.'),
    );

    const inputLabel = element('label', 'amount-label');
    inputLabel.append(element('span', 'visually-hidden', '금액 입력'));
    const input = element('input', 'amount-input');
    input.dataset.testid = 'amount-input';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.placeholder = '0';
    input.setAttribute('aria-describedby', 'amount-help');
    inputLabel.append(input, element('span', 'amount-suffix', '원'));

    const amountDisplay = element('p', 'amount-preview', '금액을 입력해 주세요');
    amountDisplay.id = 'amount-help';
    const amountWords = element('p', 'amount-words', '');
    const showQr = action('QR 보여주기', 'button button--primary button--main');
    showQr.disabled = true;

    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 6);
      input.value = digits;
      amount = parseAmount(digits);
      showQr.disabled = amount === null;
      amountDisplay.textContent = amount === null ? '금액을 입력해 주세요' : formatWon(amount);
      amountWords.textContent = amount === null ? '100원부터 50만원까지 입력할 수 있어요.' : `(${formatWonWords(amount)})`;
    });
    showQr.addEventListener('click', () => void renderQr());

    content.append(inputLabel, amountDisplay, amountWords);
    if (notice) {
      content.append(element('p', 'notice', notice));
      notice = '';
    }
    content.append(showQr);
    view.append(content);
    replace(view);
    input.focus();
  }

  async function renderQr(): Promise<void> {
    const current = seller();
    if (!current || amount === null) return;

    const confirmedAmount = amount;
    const payUrl = buildPayUrl(dependencies.baseUrl, current.id, confirmedAmount);
    const view = element('section', 'screen screen--qr');
    view.append(sellerBanner(current));

    const content = element('div', 'content-card qr-card');
    content.append(
      element('p', 'qr-recipient', `받는 분: ${current.label}`),
      element('p', 'qr-amount', formatWon(confirmedAmount)),
      element('p', 'amount-words', `(${formatWonWords(confirmedAmount)})`),
    );
    const status = element('p', 'lead', 'QR을 준비하고 있어요…');
    content.append(status);
    view.append(content);
    replace(view);

    try {
      const dataUrl = await dependencies.makeQr(payUrl);
      const frame = element('div', 'qr-frame');
      frame.style.setProperty('--seller-color', current.color);
      const image = element('img', 'qr-image');
      image.src = dataUrl;
      image.alt = `${formatWon(confirmedAmount)} 송금 안내 QR 코드`;
      frame.append(image);
      status.replaceWith(frame);

      content.append(
        element('p', 'lead', '손님 휴대폰 카메라로 찍어 주세요.'),
        element('p', 'confirm-guide', `${current.label} 휴대폰에 입금 알림이 왔는지 먼저 확인하세요.`),
      );
      const confirm = action('입금 확인 후 다음 손님', 'button button--success button--main');
      confirm.addEventListener('click', () => {
        const saved = recordSale(dependencies.storage, {
          occurredAt: dependencies.now().toISOString(),
          sellerId: current.id,
          amount: confirmedAmount,
        });
        amount = null;
        notice = saved ? '판매 기록을 저장했어요.' : '기록은 저장하지 못했지만 다음 결제를 계속할 수 있어요.';
        renderAmount();
      });
      const retry = action('금액 다시 입력', 'button button--quiet');
      retry.addEventListener('click', renderAmount);
      content.append(confirm, retry);
    } catch {
      status.textContent = 'QR을 만들지 못했어요. 금액을 다시 입력해 주세요.';
      const retry = action('금액 다시 입력', 'button button--primary');
      retry.addEventListener('click', renderAmount);
      content.append(retry);
    }
  }

  function renderRecords(): void {
    const summary = getTodaySummary(getSales(dependencies.storage), dependencies.now());
    const view = element('section', 'screen');
    const content = element('div', 'content-card records-card');
    content.append(
      element('h1', undefined, '오늘 판매 기록'),
      element('p', 'record-total', `오늘 판매 ${summary.count}건`),
      element('p', 'record-amount', formatWon(summary.total)),
    );

    const list = element('ol', 'record-list');
    if (summary.entries.length === 0) {
      list.append(element('li', 'record-empty', '아직 저장된 판매가 없어요.'));
    } else {
      for (const sale of summary.entries) {
        const label = getSeller(config, sale.sellerId)?.label ?? `사용자 ${sale.sellerId}`;
        const time = new Date(sale.occurredAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        list.append(element('li', 'record-item', `${time} · ${label} · ${formatWon(sale.amount)}`));
      }
    }
    const close = action('금액 입력으로 돌아가기', 'button button--primary button--main');
    close.addEventListener('click', renderAmount);
    content.append(list, close);
    view.append(content);
    replace(view);
  }

  if (seller()) renderAmount();
  else renderChoice();
}

const mount = document.querySelector<HTMLElement>('[data-seller-app]');
if (mount) {
  const config = readAppConfig();
  if (!config.ok) {
    mount.textContent = config.message;
    mount.className = 'fatal-error';
  } else {
    createSellerApp(mount, config.value, {
      storage: localStorage,
      baseUrl: document.baseURI,
      makeQr: defaultMakeQr,
      now: () => new Date(),
    });
  }
}
