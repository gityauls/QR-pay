import QRCode from 'qrcode';
import { getSeller, type AppConfig, type Seller, type SellerId } from '../config';
import { SETUP_BANKS } from '../lib/banks';
import { copyText } from '../lib/clipboard';
import {
  chromeIntentUrl, createInstallController, detectBrowser, detectInAppBrowser, isStandaloneDisplay, kakaoExternalUrl,
  type BrowserKind, type InAppBrowser, type InstallController,
} from '../lib/install';
import { addAmount, applyKey, type KeypadKey } from '../lib/keypad';
import {
  addSeller, createLocalConfig, deleteSeller, loadLocalConfig, saveLocalConfig,
  updateSeller, updateShopName, type SellerInput,
} from '../lib/local-config';
import { formatWon, formatWonWords, parseAmount } from '../lib/money';
import { buildPayUrl } from '../lib/pay-url';
import { detectPlatform, type Platform } from '../lib/platform';
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
type ShareResult = 'shared' | 'cancelled' | 'unsupported';
type SellerDependencies = {
  storage: StorageLike;
  baseUrl: string;
  makeQr: (url: string) => Promise<string>;
  now: () => Date;
  timers?: TimerDependencies;
  // Defaults describe an app already opened from the home screen.
  standalone?: boolean;
  platform?: Platform;
  browser?: BrowserKind;
  inApp?: InAppBrowser;
  install?: InstallController;
  open?: (url: string) => void;
  share?: (data: ShareData) => Promise<ShareResult>;
  copy?: (text: string) => Promise<boolean>;
};

const SHARE_TEXT = '행사장에서 계좌이체를 QR로 받는 앱이에요. 링크를 눌러 휴대폰에 설치하세요.';

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

async function defaultShare(data: ShareData): Promise<ShareResult> {
  if (typeof navigator.share !== 'function') return 'unsupported';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

function steps(lines: readonly string[]): HTMLOListElement {
  const list = element('ol', 'install-steps');
  for (const line of lines) list.append(element('li', undefined, line));
  return list;
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
  const standalone = dependencies.standalone ?? true;
  const isIos = dependencies.platform === 'ios';
  const open = dependencies.open ?? ((url: string) => { window.location.href = url; });
  const appUrl = new URL('./', dependencies.baseUrl).toString();
  const guideUrl = new URL('./guide/', dependencies.baseUrl).toString();
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
    const who = element('div', 'app-header__who');
    who.append(
      element('span', 'app-header__caption', '현재 받는 분'),
      element('strong', 'app-header__name', current.label),
    );
    const account = element('div', 'app-header__account');
    account.append(
      element('span', 'app-header__bank', current.bank),
      element('span', 'app-header__number', current.accountDisplay),
    );
    header.append(who, account);
    if (headerAction) header.append(headerAction);
    return header;
  }
  function guideLink(): HTMLAnchorElement {
    const link = element('a', 'button button--text guide-link', '그림으로 보는 사용법');
    link.href = guideUrl;
    return link;
  }
  function continueWithoutInstall() {
    if (config) renderAmount();
    else renderSetup();
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
      renderAmount();
    });
    card.append(shop, fields.container, error, save);
    view.append(card);
    replace(view);
  }

  function renderInAppEscape(kind: Exclude<InAppBrowser, null>): void {
    const view = shell('install-screen');
    const card = element('div', 'panel install-panel');
    const browserName = isIos ? 'Safari' : '크롬';
    card.append(element('p', 'app-kicker', 'QR 송금'));
    if (kind === 'kakao') {
      card.append(
        element('h1', 'screen-title', `${browserName}으로 엽니다`),
        element('p', 'body-text', '카카오톡 안에서는 앱을 설치할 수 없어서 휴대폰 인터넷 앱으로 다시 엽니다.'),
        element('p', 'body-text muted', '자동으로 열리지 않으면 아래 버튼을 눌러 주세요.'),
      );
      const retry = action('인터넷 앱으로 열기', 'button button--primary primary-action');
      retry.addEventListener('click', () => open(kakaoExternalUrl(appUrl)));
      card.append(retry);
      open(kakaoExternalUrl(appUrl));
    } else if (isIos) {
      card.append(
        element('h1', 'screen-title', 'Safari로 열어 주세요'),
        element('p', 'body-text', '이 앱 안에서는 설치할 수 없어요. 화면 구석의 ⋯ 메뉴에서 “Safari로 열기”를 눌러 주세요.'),
      );
    } else {
      card.append(
        element('h1', 'screen-title', '크롬으로 열어 주세요'),
        element('p', 'body-text', '이 앱 안에서는 설치할 수 없어요. 아래 버튼을 누르면 크롬에서 다시 열립니다.'),
      );
      const chrome = action('크롬으로 열기', 'button button--primary primary-action');
      chrome.addEventListener('click', () => open(chromeIntentUrl(appUrl)));
      card.append(chrome);
    }
    view.append(card);
    replace(view);
  }

  function renderInstall(): void {
    const install = dependencies.install;
    const view = shell('install-screen');
    const card = element('div', 'panel install-panel');
    card.append(
      element('p', 'app-kicker', 'QR 송금'),
      element('h1', 'screen-title', '휴대폰에 설치하기'),
      element('p', 'body-text', '설치하면 홈 화면의 “QR 송금” 아이콘으로 바로 열 수 있어요.'),
    );
    if (isIos) {
      card.append(
        steps([
          '화면 아래(또는 위)의 공유 버튼 □↑ 을 누르세요.',
          '“홈 화면에 추가”를 누르세요.',
          '오른쪽 위 “추가”를 누르세요.',
          '홈 화면의 “QR 송금” 아이콘을 눌러 정보를 입력하세요.',
        ]),
        element('p', 'body-text muted', '아이폰은 아이콘으로 연 다음에 정보를 입력해야 저장이 유지돼요.'),
      );
    } else {
      const status = element('div', 'install-status');
      status.setAttribute('role', 'status');
      const installButton = action('휴대폰에 설치하기', 'button button--primary primary-action install-action');
      installButton.addEventListener('click', async () => {
        const outcome = install ? await install.prompt() : 'unavailable';
        if (outcome === 'accepted') { renderInstalled(); return; }
        if (outcome === 'dismissed') {
          status.replaceChildren(element('p', 'body-text muted', '설치를 취소했어요. 다시 누르면 설치할 수 있어요.'));
          return;
        }
        status.replaceChildren(
          element('p', 'body-text', '브라우저 메뉴에서 설치해 주세요.'),
          steps(dependencies.browser === 'samsung'
            ? ['화면 아래 ≡ 메뉴를 누르세요.', '“현재 페이지 추가”를 누르세요.', '“홈 화면”을 누르세요.']
            : ['오른쪽 위 ⋮ 메뉴를 누르세요.', '“홈 화면에 추가” 또는 “앱 설치”를 누르세요.', '“설치”를 누르세요.']),
        );
      });
      card.append(installButton, status);
    }
    const skip = action(config ? '설치하지 않고 계속 쓰기' : '설치하지 않고 바로 쓰기', 'button button--secondary primary-action');
    skip.addEventListener('click', continueWithoutInstall);
    card.append(skip, guideLink());
    view.append(card);
    replace(view);
  }

  function renderInstalled(): void {
    const view = shell('install-screen');
    const card = element('div', 'panel install-panel');
    card.append(
      element('p', 'app-kicker', 'QR 송금'),
      element('h1', 'screen-title', '설치됐어요'),
      element('p', 'body-text', '홈 화면에 생긴 “QR 송금” 아이콘을 눌러 시작하세요.'),
      element('p', 'body-text muted', '아이콘이 바로 안 보이면 홈 화면을 옆으로 넘겨 보세요.'),
    );
    const here = action('여기서 바로 시작하기', 'button button--secondary primary-action');
    here.addEventListener('click', continueWithoutInstall);
    card.append(here);
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
    const keys: Array<[KeypadKey, readonly string[]]> = [
      ['1', ['1']], ['2', ['2']], ['3', ['3']], ['4', ['4']], ['5', ['5']], ['6', ['6']],
      ['7', ['7']], ['8', ['8']], ['9', ['9']], ['clear', ['전체', '지우기']],
      ['0', ['0']], ['backspace', ['한 글자', '지우기']],
    ];
    for (const [key, lines] of keys) {
      const utility = lines.length > 1;
      const keyButton = action('', `keypad__key${utility ? ' keypad__utility' : ''}`);
      const label = element('span', 'keypad__label');
      // Separate spans stack the utility words on two lines; the space keeps the text readable as one phrase.
      lines.forEach((line, index) => {
        if (index > 0) label.append(' ');
        label.append(utility ? element('span', 'keypad__line', line) : line);
      });
      keyButton.append(label);
      if (utility) keyButton.setAttribute('aria-label', lines.join(' '));
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
    card.append(list, add, summaryBox, choose, back, element('h2', 'settings-heading', '앱 나누기'));
    const shareStatus = element('p', 'share-status');
    shareStatus.setAttribute('role', 'status');
    const shareApp = action('다른 분께 앱 보내기', 'button button--secondary primary-action');
    shareApp.addEventListener('click', async () => {
      const shared = await (dependencies.share ?? defaultShare)({ title: '행사 QR 송금', text: SHARE_TEXT, url: appUrl });
      if (shared !== 'unsupported') { shareStatus.textContent = ''; return; }
      const copied = await (dependencies.copy ?? copyText)(appUrl);
      shareStatus.textContent = copied
        ? '링크를 복사했어요. 카카오톡 대화방에 붙여넣어 보내세요.'
        : `이 주소를 보내 주세요: ${appUrl}`;
    });
    card.append(shareApp, shareStatus);
    if (!standalone) {
      const installApp = action('휴대폰에 설치하기', 'button button--secondary primary-action');
      installApp.addEventListener('click', renderInstall);
      card.append(installApp);
    }
    card.append(guideLink());
    view.append(card);
    replace(view);
  }

  if (dependencies.inApp) renderInAppEscape(dependencies.inApp);
  else if (!config && !standalone) renderInstall();
  else if (!config) renderSetup();
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
  const userAgent = navigator.userAgent;
  createSellerApp(mount, {
    storage: localStorage,
    baseUrl: document.baseURI,
    makeQr: defaultMakeQr,
    now: () => new Date(),
    standalone: isStandaloneDisplay(window as unknown as Parameters<typeof isStandaloneDisplay>[0]),
    platform: detectPlatform(navigator),
    browser: detectBrowser(userAgent),
    inApp: detectInAppBrowser(userAgent),
    install: createInstallController(window),
  });
}
