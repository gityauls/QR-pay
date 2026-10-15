import QRCode from 'qrcode';
import { getSeller, type AppConfig, type Seller, type SellerId } from '../config';
import { SETUP_BANKS } from '../lib/banks';
import { addAmount, applyKey, type KeypadKey } from '../lib/keypad';
import {
  addSeller, createLocalConfig, deleteSeller, loadLocalConfig, saveLocalConfig,
  updateSeller, updateShopName, type SellerInput,
} from '../lib/local-config';
import { formatWon, formatWonWords, parseAmount } from '../lib/money';
import { buildPayUrl } from '../lib/pay-url';
import { getSales, getTodaySummary, loadCurrentSeller, recordSale, saveCurrentSeller, type StorageLike } from '../lib/storage';
import { registerPwa } from '../pwa';
import '../styles.css';

type TimerHandle = ReturnType<typeof globalThis.setTimeout> | number;
type TimerDependencies = {
  setTimeout: (callback: () => void, delay: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
  setInterval: (callback: () => void, delay: number) => TimerHandle;
  clearInterval: (handle: TimerHandle) => void;
};
type SellerDependencies = {
  storage: StorageLike;
  baseUrl: string;
  makeQr: (url: string) => Promise<string>;
  now: () => Date;
  timers?: TimerDependencies;
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
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
    errorCorrectionLevel: 'M', margin: 4, width: 720,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

function defaultTimers(): TimerDependencies {
  return {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: (handle) => globalThis.clearTimeout(handle),
    setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
    clearInterval: (handle) => globalThis.clearInterval(handle),
  };
}

function field(labelText: string, name: string, value = '', type = 'text'): HTMLLabelElement {
  const label = element('label', 'form-field');
  label.append(element('span', 'form-label', labelText));
  const input = element('input', 'form-input');
  input.name = name;
  input.type = type;
  input.value = value;
  input.autocomplete = 'off';
  label.append(input);
  return label;
}

function sellerFields(existing?: Seller): { container: HTMLElement; read: () => SellerInput } {
  const container = element('div', 'seller-form-fields');
  const labelField = field('받는 분 표시 이름', 'label', existing?.label ?? '');
  const bankLabel = element('label', 'form-field');
  bankLabel.append(element('span', 'form-label', '은행'));
  const bank = element('select', 'form-input');
  bank.name = 'bank';
  bank.append(element('option', undefined, '은행을 선택하세요'));
  bank.options[0].value = '';
  for (const bankName of SETUP_BANKS) {
    const option = element('option', undefined, bankName);
    option.value = bankName;
    bank.append(option);
  }
  const knownBank = existing && SETUP_BANKS.includes(existing.bank as (typeof SETUP_BANKS)[number]);
  bank.value = knownBank ? existing.bank : '';
  bankLabel.append(bank);
  const custom = field('목록에 없는 은행', 'customBank', knownBank ? '' : existing?.bank ?? '');
  const holder = field('예금주 이름', 'holder', existing?.holder ?? '');
  const account = field('계좌번호', 'accountDisplay', existing?.accountDisplay ?? '', 'tel');
  container.append(labelField, bankLabel, custom, holder, account);
  return {
    container,
    read: () => ({
      label: container.querySelector<HTMLInputElement>('[name=label]')?.value ?? '',
      bank: container.querySelector<HTMLSelectElement>('[name=bank]')?.value
        || container.querySelector<HTMLInputElement>('[name=customBank]')?.value.trim() || '',
      holder: container.querySelector<HTMLInputElement>('[name=holder]')?.value ?? '',
      accountDisplay: container.querySelector<HTMLInputElement>('[name=accountDisplay]')?.value ?? '',
    }),
  };
}

export function createSellerApp(root: HTMLElement, dependencies: SellerDependencies): void {
  const timers = dependencies.timers ?? defaultTimers();
  let config: AppConfig | null = loadLocalConfig(dependencies.storage);
  let currentSellerId: SellerId | null = loadCurrentSeller(dependencies.storage);
  let digits = '';
  let activeTimer: TimerHandle | null = null;
  let activeInterval: TimerHandle | null = null;

  const seller = (): Seller | null => config ? getSeller(config, currentSellerId) : null;
  function clearTimers() {
    if (activeTimer !== null) timers.clearTimeout(activeTimer);
    if (activeInterval !== null) timers.clearInterval(activeInterval);
    activeTimer = null;
    activeInterval = null;
  }
  function replace(view: HTMLElement) { clearTimers(); root.replaceChildren(view); }
  function shell(modifier = '') { return element('section', `app-shell${modifier ? ` ${modifier}` : ''}`); }
  function errorLine() {
    const line = element('p', 'form-error');
    line.setAttribute('role', 'alert');
    return line;
  }
  function persist(next: AppConfig, error: HTMLElement): boolean {
    if (!saveLocalConfig(dependencies.storage, next)) {
      error.textContent = '설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.';
      return false;
    }
    config = next;
    return true;
  }
  function sellerHeader(current: Seller, headerAction?: HTMLElement): HTMLElement {
    const header = element('header', 'app-header');
    header.style.setProperty('--seller-color', current.color);
    header.append(
      element('span', 'app-header__caption', '현재 받는 분'),
      element('strong', 'app-header__name', current.label),
      element('span', 'app-header__account', `${current.bank}  ${current.accountDisplay}`),
    );
    if (headerAction) header.append(headerAction);
    return header;
  }

  function renderSetup(): void {
    const view = shell('setup-screen');
    const card = element('div', 'panel setup-panel');
    card.append(
      element('p', 'app-kicker', 'QR 송금'),
      element('h1', 'screen-title', '처음 설정'),
      element('p', 'body-text muted', '입력한 정보는 이 휴대폰에만 저장됩니다.'),
    );
    const shop = field('판매점 이름', 'shopName');
    const fields = sellerFields();
    const error = errorLine();
    const save = action('저장하고 시작하기', 'button button--primary primary-action');
    save.addEventListener('click', () => {
      const shopName = shop.querySelector<HTMLInputElement>('input')?.value ?? '';
      const result = createLocalConfig(shopName, fields.read());
      if (!result.ok) { error.textContent = result.message; return; }
      if (!persist(result.value, error)) return;
      currentSellerId = result.value.sellers[0].id;
      saveCurrentSeller(dependencies.storage, currentSellerId);
      renderInstallHelp();
    });
    card.append(shop, fields.container, error, save);
    view.append(card);
    replace(view);
  }

  function renderInstallHelp(): void {
    const view = shell('install-screen');
    const card = element('div', 'panel install-panel');
    card.append(
      element('h1', 'screen-title', '홈 화면에 설치'),
      element('p', 'body-text', '브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택하면 다음부터 아이콘으로 바로 열 수 있어요.'),
      element('p', 'body-text muted', '지금 설치하지 않아도 브라우저에서 계속 사용할 수 있습니다.'),
    );
    const start = action('금액 입력 시작', 'button button--primary primary-action');
    start.addEventListener('click', renderAmount);
    card.append(start);
    view.append(card);
    replace(view);
  }

  function renderChoice(): void {
    if (!config) { renderSetup(); return; }
    const view = shell('seller-choice-screen');
    const card = element('div', 'panel seller-choice-panel');
    card.append(element('p', 'app-kicker', config.shopName), element('h1', 'screen-title', '받는 분을 선택해 주세요'));
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
    if (!current) { currentSellerId = null; renderChoice(); return; }
    const view = shell('app-shell--compact');
    const settings = action('설정', 'button button--secondary button--compact app-header__action');
    settings.addEventListener('click', renderSettings);
    view.append(sellerHeader(current, settings));
    const card = element('div', 'panel amount-panel');
    card.append(element('h1', 'screen-title amount-title', '받을 금액'));
    const amountDisplay = element('p', 'amount-display', '0원');
    amountDisplay.dataset.testid = 'amount-display';
    const amountWords = element('p', 'amount-words', '1,000원 단위 · 최대 500,000원');
    amountWords.setAttribute('aria-live', 'polite');
    card.append(amountDisplay, amountWords);
    const createQr = action('QR 만들기', 'button button--primary primary-action');
    createQr.disabled = true;
    const refresh = () => {
      const numeric = digits ? Number(digits) : 0;
      const valid = parseAmount(digits);
      amountDisplay.textContent = formatWon(numeric);
      amountWords.textContent = !digits
        ? '1,000원 단위 · 최대 500,000원'
        : valid === null ? '1,000원부터 500,000원까지 1,000원 단위로 입력해 주세요.' : formatWonWords(valid);
      createQr.disabled = valid === null;
    };
    const quickAmounts = element('div', 'quick-amounts');
    for (const [step, label] of [[10_000, '+1만원'], [5_000, '+5천원'], [1_000, '+1천원']] as const) {
      const quick = action(label, 'quick-amount');
      quick.dataset.quickAmount = String(step);
      quick.addEventListener('click', () => { digits = addAmount(digits, step); refresh(); });
      quickAmounts.append(quick);
    }
    const keypad = element('div', 'keypad');
    const keys: Array<[KeypadKey, string, string]> = [
      ['1', '1', ''], ['2', '2', ''], ['3', '3', ''], ['4', '4', ''], ['5', '5', ''], ['6', '6', ''],
      ['7', '7', ''], ['8', '8', ''], ['9', '9', ''], ['clear', '전체 지우기', 'keypad__utility'],
      ['0', '0', ''], ['backspace', '한 글자 지우기', 'keypad__utility'],
    ];
    for (const [key, label, extra] of keys) {
      const keyButton = action(label, `keypad__key${extra ? ` ${extra}` : ''}`);
      keyButton.dataset.keypadKey = key;
      keyButton.addEventListener('click', () => { digits = applyKey(digits, key); refresh(); });
      keypad.append(keyButton);
    }
    createQr.addEventListener('click', () => void renderQr());
    card.append(quickAmounts, keypad, createQr);
    view.append(card);
    replace(view);
  }

  async function renderQr(): Promise<void> {
    const current = seller();
    const amount = parseAmount(digits);
    if (!config || !current || amount === null) return;
    const payUrl = buildPayUrl(dependencies.baseUrl, config.shopName, current, amount);
    const view = shell('qr-screen');
    view.append(sellerHeader(current));
    const card = element('div', 'panel qr-panel');
    card.append(element('p', 'qr-label', '고객에게 이 QR을 보여 주세요'), element('h1', 'qr-amount', formatWon(amount)));
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
      image.alt = `${formatWon(amount)} 송금 QR 코드`;
      frame.append(image);
      status.replaceWith(frame);
      const autoReturn = element('p', 'auto-return', '15초 뒤 금액 입력 화면으로 돌아갑니다.');
      card.append(autoReturn);
      recordSale(dependencies.storage, { occurredAt: dependencies.now().toISOString(), sellerId: current.id, amount });
      let seconds = 15;
      activeInterval = timers.setInterval(() => {
        seconds -= 1;
        if (seconds > 0) autoReturn.textContent = `${seconds}초 뒤 금액 입력 화면으로 돌아갑니다.`;
      }, 1_000);
      activeTimer = timers.setTimeout(() => { digits = ''; renderAmount(); }, 15_000);
    } catch {
      status.textContent = 'QR을 만들지 못했습니다. 다시 시도해 주세요.';
    }
  }

  function renderSellerForm(existing?: Seller): void {
    if (!config) return;
    const view = shell();
    const card = element('div', 'panel settings-panel');
    card.append(element('h1', 'screen-title', existing ? '받는 분 수정' : '받는 분 추가'));
    const fields = sellerFields(existing);
    const error = errorLine();
    const save = action('받는 분 저장', 'button button--primary primary-action');
    save.addEventListener('click', () => {
      if (!config) return;
      const result = existing ? updateSeller(config, existing.id, fields.read()) : addSeller(config, fields.read());
      if (!result.ok) { error.textContent = result.message; return; }
      if (persist(result.value, error)) renderSettings();
    });
    const cancel = action('취소', 'button button--secondary primary-action');
    cancel.addEventListener('click', renderSettings);
    card.append(fields.container, error, save, cancel);
    view.append(card);
    replace(view);
  }

  function renderShopForm(): void {
    if (!config) return;
    const view = shell();
    const card = element('div', 'panel settings-panel');
    card.append(element('h1', 'screen-title', '판매점 이름 수정'));
    const shop = field('판매점 이름', 'shopName', config.shopName);
    const error = errorLine();
    const save = action('판매점 이름 저장', 'button button--primary primary-action');
    save.addEventListener('click', () => {
      if (!config) return;
      const result = updateShopName(config, shop.querySelector<HTMLInputElement>('input')?.value ?? '');
      if (!result.ok) { error.textContent = result.message; return; }
      if (persist(result.value, error)) renderSettings();
    });
    card.append(shop, error, save);
    view.append(card);
    replace(view);
  }

  function renderSettings(): void {
    const current = seller();
    if (!config || !current) { renderChoice(); return; }
    const summary = getTodaySummary(getSales(dependencies.storage), dependencies.now());
    const view = shell();
    view.append(sellerHeader(current));
    const card = element('div', 'panel settings-panel');
    card.append(element('h1', 'screen-title', '설정'));
    const shopRow = element('div', 'settings-row');
    shopRow.append(element('div', 'settings-row__value', config.shopName));
    const editShop = action('판매점 이름 수정', 'button button--secondary');
    editShop.addEventListener('click', renderShopForm);
    shopRow.append(editShop);
    card.append(shopRow, element('h2', 'settings-heading', '받는 분 관리'));
    const list = element('div', 'seller-manage-list');
    for (const candidate of config.sellers) {
      const item = element('section', 'seller-manage-card');
      item.dataset.sellerId = candidate.id;
      item.style.setProperty('--seller-color', candidate.color);
      item.append(
        element('strong', 'seller-manage-card__name', candidate.label),
        element('span', 'seller-manage-card__detail', `${candidate.bank}  ${candidate.accountDisplay}`),
      );
      const actions = element('div', 'seller-manage-actions');
      const edit = action('수정', 'button button--secondary button--small');
      edit.addEventListener('click', () => renderSellerForm(candidate));
      const remove = action('삭제', 'button button--danger button--small');
      remove.disabled = config.sellers.length <= 1;
      remove.addEventListener('click', () => {
        const confirm = element('div', 'delete-confirm');
        confirm.append(element('p', undefined, `${candidate.label}님을 정말 삭제할까요?`));
        const yes = action('삭제 확인', 'button button--danger button--small');
        const no = action('취소', 'button button--secondary button--small');
        yes.addEventListener('click', () => {
          if (!config) return;
          const result = deleteSeller(config, candidate.id);
          if (!result.ok) return;
          const error = errorLine();
          if (!persist(result.value, error)) { item.append(error); return; }
          if (currentSellerId === candidate.id) {
            currentSellerId = result.value.sellers[0].id;
            saveCurrentSeller(dependencies.storage, currentSellerId);
          }
          renderSettings();
        });
        no.addEventListener('click', () => confirm.remove());
        confirm.append(yes, no);
        item.append(confirm);
      });
      actions.append(edit, remove);
      item.append(actions);
      if (config.sellers.length <= 1) item.append(element('small', 'muted', '받는 분을 한 명 이상 유지해 주세요.'));
      list.append(item);
    }
    const add = action('+ 받는 분 추가', 'button button--primary primary-action');
    add.addEventListener('click', () => renderSellerForm());
    const summaryBox = element('div', 'record-summary', `오늘 QR ${summary.count}건 · ${formatWon(summary.total)}`);
    const choose = action('받는 분 바꾸기', 'button button--secondary primary-action');
    choose.disabled = config.sellers.length <= 1;
    choose.addEventListener('click', () => { currentSellerId = null; digits = ''; renderChoice(); });
    const back = action('금액 입력으로 돌아가기', 'button button--secondary primary-action');
    back.addEventListener('click', renderAmount);
    card.append(list, add, summaryBox, choose, back);
    view.append(card);
    replace(view);
  }

  if (!config) renderSetup();
  else if (config.sellers.length === 1 && !seller()) {
    currentSellerId = config.sellers[0].id;
    saveCurrentSeller(dependencies.storage, currentSellerId);
    renderAmount();
  } else if (seller()) renderAmount();
  else renderChoice();
}

const mount = document.querySelector<HTMLElement>('[data-seller-app]');
if (mount) {
  void registerPwa(navigator, document.baseURI);
  createSellerApp(mount, {
    storage: localStorage,
    baseUrl: document.baseURI,
    makeQr: defaultMakeQr,
    now: () => new Date(),
  });
}
