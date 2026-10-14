import QRCode from 'qrcode';
import { getSeller, readAppConfig, type AppConfig, type Seller } from '../config';
import { applyKey, type KeypadKey } from '../lib/keypad';
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

type TimerHandle = ReturnType<typeof globalThis.setTimeout> | number;

type TimerDependencies = {
  setTimeout: (callback: () => void, delay: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
};

type SellerDependencies = {
  storage: StorageLike;
  baseUrl: string;
  makeQr: (url: string) => Promise<string>;
  now: () => Date;
  timers?: TimerDependencies;
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

function defaultTimers(): TimerDependencies {
  return {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: (handle) => globalThis.clearTimeout(handle),
  };
}

export function createSellerApp(
  root: HTMLElement,
  config: AppConfig,
  dependencies: SellerDependencies,
): void {
  const timers = dependencies.timers ?? defaultTimers();
  let currentSellerId = loadCurrentSeller(dependencies.storage);
  let digits = '';
  let activeTimer: TimerHandle | null = null;

  const seller = (): Seller | null => getSeller(config, currentSellerId);

  function clearActiveTimer(): void {
    if (activeTimer === null) return;
    timers.clearTimeout(activeTimer);
    activeTimer = null;
  }

  function replace(view: HTMLElement): void {
    clearActiveTimer();
    root.replaceChildren(view);
  }

  function shell(modifier = ''): HTMLElement {
    return element('section', `app-shell${modifier ? ` ${modifier}` : ''}`);
  }

  function sellerHeader(current: Seller): HTMLElement {
    const header = element('header', 'app-header');
    header.style.setProperty('--seller-color', current.color);
    header.append(
      element('span', 'app-header__caption', '현재 받는 분'),
      element('strong', 'app-header__name', current.label),
      element('span', 'app-header__account', `${current.bank}  ${current.accountDisplay}`),
    );
    return header;
  }

  function renderChoice(): void {
    const view = shell('seller-choice-screen');
    const card = element('div', 'panel seller-choice-panel');
    card.append(
      element('p', 'app-kicker', config.shopName),
      element('h1', undefined, '받는 분을 선택해 주세요'),
      element('p', 'body-text muted', '처음 한 번만 선택하면 다음부터 바로 시작합니다.'),
    );

    const choices = element('div', 'seller-choice-list');
    for (const candidate of config.sellers) {
      const choose = action(candidate.label, 'seller-choice-button');
      choose.style.setProperty('--seller-color', candidate.color);
      choose.append(element('span', 'seller-choice-button__detail', `${candidate.bank}  ${candidate.accountDisplay}`));
      choose.addEventListener('click', () => {
        currentSellerId = candidate.id;
        saveCurrentSeller(dependencies.storage, candidate.id);
        digits = '';
        renderAmount();
      });
      choices.append(choose);
    }
    card.append(choices);
    view.append(card);
    replace(view);
  }

  function renderAmount(): void {
    const current = seller();
    if (!current) {
      currentSellerId = null;
      renderChoice();
      return;
    }

    const view = shell();
    view.append(sellerHeader(current));

    const toolbar = element('div', 'toolbar');
    const settings = action('설정', 'button button--secondary button--compact');
    settings.addEventListener('click', renderSettings);
    toolbar.append(settings);
    view.append(toolbar);

    const card = element('div', 'panel amount-panel');
    card.append(element('h1', 'screen-title', '받을 금액을 입력해 주세요'));

    const amountDisplay = element('p', 'amount-display', '0원');
    amountDisplay.dataset.testid = 'amount-display';
    const amountWords = element('p', 'amount-words', '숫자 버튼을 눌러 주세요');
    amountWords.setAttribute('aria-live', 'polite');
    card.append(amountDisplay, amountWords);

    const keypad = element('div', 'keypad');
    const keyDefinitions: Array<[KeypadKey, string, string]> = [
      ['1', '1', ''], ['2', '2', ''], ['3', '3', ''],
      ['4', '4', ''], ['5', '5', ''], ['6', '6', ''],
      ['7', '7', ''], ['8', '8', ''], ['9', '9', ''],
      ['clear', '전체 지우기', 'keypad__utility'],
      ['0', '0', ''],
      ['backspace', '한 글자 지우기', 'keypad__utility'],
    ];

    const createQr = action('QR 만들기', 'button button--primary primary-action');
    createQr.disabled = true;

    function refreshAmount(): void {
      const numeric = digits ? Number(digits) : 0;
      const valid = parseAmount(digits);
      amountDisplay.textContent = formatWon(numeric);
      if (!digits) amountWords.textContent = '숫자 버튼을 눌러 주세요';
      else if (valid === null) amountWords.textContent = '1,000원 단위로 입력해 주세요';
      else amountWords.textContent = formatWonWords(valid);
      createQr.disabled = valid === null;
    }

    for (const [key, label, extraClass] of keyDefinitions) {
      const keyButton = action(label, `keypad__key${extraClass ? ` ${extraClass}` : ''}`);
      keyButton.dataset.keypadKey = key;
      keyButton.setAttribute('aria-label', label);
      keyButton.addEventListener('click', () => {
        digits = applyKey(digits, key);
        refreshAmount();
      });
      keypad.append(keyButton);
    }

    createQr.addEventListener('click', () => void renderQr());
    card.append(keypad, createQr);
    view.append(card);
    replace(view);
  }

  async function renderQr(): Promise<void> {
    const current = seller();
    const amount = parseAmount(digits);
    if (!current || amount === null) return;

    const confirmedAmount = amount;
    const payUrl = buildPayUrl(dependencies.baseUrl, current.id, confirmedAmount);
    const view = shell('qr-screen');
    view.append(sellerHeader(current));

    const card = element('div', 'panel qr-panel');
    card.append(
      element('p', 'qr-label', '고객에게 이 QR을 보여 주세요'),
      element('h1', 'qr-amount', formatWon(confirmedAmount)),
      element('p', 'amount-words', formatWonWords(confirmedAmount)),
    );
    const status = element('p', 'body-text muted', 'QR을 만들고 있습니다.');
    card.append(status);
    view.append(card);
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
      card.append(element('p', 'auto-return', '15초 후 다음 손님 화면으로 자동 이동합니다.'));

      recordSale(dependencies.storage, {
        occurredAt: dependencies.now().toISOString(),
        sellerId: current.id,
        amount: confirmedAmount,
      });

      activeTimer = timers.setTimeout(() => {
        activeTimer = null;
        digits = '';
        renderAmount();
      }, 15_000);
    } catch {
      status.textContent = 'QR을 만들지 못했습니다. 다시 시도해 주세요.';
      const retry = action('금액 입력으로 돌아가기', 'button button--primary primary-action');
      retry.addEventListener('click', renderAmount);
      card.append(retry);
    }
  }

  function renderSettings(): void {
    const current = seller();
    if (!current) {
      renderChoice();
      return;
    }

    const summary = getTodaySummary(getSales(dependencies.storage), dependencies.now());
    const view = shell();
    view.append(sellerHeader(current));
    const card = element('div', 'panel settings-panel');
    card.append(
      element('h1', 'screen-title', '설정'),
      element('p', 'record-total', `오늘 QR ${summary.count}건`),
      element('p', 'record-amount', formatWon(summary.total)),
    );

    const list = element('ol', 'record-list');
    if (summary.entries.length === 0) {
      list.append(element('li', 'record-empty', '오늘 만든 QR이 없습니다.'));
    } else {
      for (const sale of summary.entries) {
        const time = new Date(sale.occurredAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        list.append(element('li', 'record-item', `${time} · ${formatWon(sale.amount)}`));
      }
    }

    const changeSeller = action('받는 분 바꾸기', 'button button--secondary primary-action');
    changeSeller.addEventListener('click', () => {
      currentSellerId = null;
      digits = '';
      renderChoice();
    });
    const back = action('금액 입력으로 돌아가기', 'button button--primary primary-action');
    back.addEventListener('click', renderAmount);
    card.append(list, changeSeller, back);
    view.append(card);
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
