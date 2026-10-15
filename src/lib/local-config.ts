import type { AppConfig, Seller, SellerId } from '../config';
import type { StorageLike } from './storage';

export const SELLER_COLORS = [
  '#155E75', '#9A3412', '#166534', '#6B21A8', '#9F1239', '#1E40AF',
] as const;

export type SellerInput = Pick<Seller, 'label' | 'bank' | 'holder' | 'accountDisplay'>;
export type ConfigResult = { ok: true; value: AppConfig } | { ok: false; message: string };
type IdFactory = () => SellerId;

const STORAGE_KEY = 'qrpay.localConfig';
const ACCOUNT_DISPLAY = /^[0-9 -]+$/;
const HEX_COLOR = /^#[0-9A-F]{6}$/i;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validateInput(input: SellerInput): { ok: true; value: Omit<Seller, 'id' | 'color'> } | { ok: false; message: string } {
  const label = clean(input.label);
  const bank = clean(input.bank);
  const holder = clean(input.holder);
  const accountDisplay = clean(input.accountDisplay);
  const accountCopy = accountDisplay.replace(/\D/g, '');

  if (!label) return { ok: false, message: '받는 분 이름을 입력해 주세요.' };
  if (label.length > 40) return { ok: false, message: '받는 분 이름은 40자 이내로 입력해 주세요.' };
  if (!bank) return { ok: false, message: '은행을 선택하거나 입력해 주세요.' };
  if (bank.length > 60) return { ok: false, message: '은행 이름은 60자 이내로 입력해 주세요.' };
  if (!holder) return { ok: false, message: '예금주 이름을 입력해 주세요.' };
  if (holder.length > 40) return { ok: false, message: '예금주 이름은 40자 이내로 입력해 주세요.' };
  if (accountDisplay.length > 40) return { ok: false, message: '계좌번호가 너무 깁니다.' };
  if (!ACCOUNT_DISPLAY.test(accountDisplay)) {
    return { ok: false, message: '계좌번호는 숫자, 공백, 하이픈만 입력해 주세요.' };
  }
  if (accountCopy.length < 8 || accountCopy.length > 20) {
    return { ok: false, message: '계좌번호는 숫자 8~20자리로 입력해 주세요.' };
  }
  return { ok: true, value: { label, bank, holder, accountDisplay, accountCopy } };
}

function nextColor(config: AppConfig): string {
  const used = new Set(config.sellers.map((seller) => seller.color.toUpperCase()));
  return SELLER_COLORS.find((color) => !used.has(color)) ?? SELLER_COLORS[config.sellers.length % SELLER_COLORS.length];
}

function defaultId(): SellerId {
  return globalThis.crypto?.randomUUID?.() ?? `seller-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function duplicateAccount(config: AppConfig, accountCopy: string, exceptId?: SellerId): boolean {
  return config.sellers.some((seller) => seller.id !== exceptId && seller.accountCopy === accountCopy);
}

export function createLocalConfig(shopNameValue: string, input: SellerInput, idFactory: IdFactory = defaultId): ConfigResult {
  const shopName = clean(shopNameValue);
  if (!shopName) return { ok: false, message: '판매점 이름을 입력해 주세요.' };
  if (shopName.length > 60) return { ok: false, message: '판매점 이름은 60자 이내로 입력해 주세요.' };
  const validated = validateInput(input);
  if (!validated.ok) return validated;
  const id = clean(idFactory());
  if (!id) return { ok: false, message: '받는 분을 만들지 못했습니다.' };
  return {
    ok: true,
    value: {
      shopName,
      sellers: [{ id, color: SELLER_COLORS[0], ...validated.value }],
    },
  };
}

export function addSeller(config: AppConfig, input: SellerInput, idFactory: IdFactory = defaultId): ConfigResult {
  const validated = validateInput(input);
  if (!validated.ok) return validated;
  if (duplicateAccount(config, validated.value.accountCopy)) {
    return { ok: false, message: '이미 등록된 계좌번호입니다.' };
  }
  const id = clean(idFactory());
  if (!id || config.sellers.some((seller) => seller.id === id)) {
    return { ok: false, message: '받는 분을 만들지 못했습니다.' };
  }
  return {
    ok: true,
    value: {
      ...config,
      sellers: [...config.sellers, { id, color: nextColor(config), ...validated.value }],
    },
  };
}

export function updateSeller(config: AppConfig, id: SellerId, input: SellerInput): ConfigResult {
  const existing = config.sellers.find((seller) => seller.id === id);
  if (!existing) return { ok: false, message: '받는 분을 찾을 수 없습니다.' };
  const validated = validateInput(input);
  if (!validated.ok) return validated;
  if (duplicateAccount(config, validated.value.accountCopy, id)) {
    return { ok: false, message: '이미 등록된 계좌번호입니다.' };
  }
  return {
    ok: true,
    value: {
      ...config,
      sellers: config.sellers.map((seller) => seller.id === id
        ? { id, color: existing.color, ...validated.value }
        : seller),
    },
  };
}

export function updateShopName(config: AppConfig, shopNameValue: string): ConfigResult {
  const shopName = clean(shopNameValue);
  if (!shopName) return { ok: false, message: '판매점 이름을 입력해 주세요.' };
  if (shopName.length > 60) return { ok: false, message: '판매점 이름은 60자 이내로 입력해 주세요.' };
  return { ok: true, value: { ...config, shopName } };
}

export function deleteSeller(config: AppConfig, id: SellerId): ConfigResult {
  if (config.sellers.length <= 1) {
    return { ok: false, message: '받는 분을 한 명 이상 유지해 주세요.' };
  }
  if (!config.sellers.some((seller) => seller.id === id)) {
    return { ok: false, message: '받는 분을 찾을 수 없습니다.' };
  }
  return { ok: true, value: { ...config, sellers: config.sellers.filter((seller) => seller.id !== id) } };
}

function isAppConfig(value: unknown): value is AppConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppConfig>;
  const shopName = clean(candidate.shopName);
  if (!shopName || shopName.length > 60 || !Array.isArray(candidate.sellers) || candidate.sellers.length === 0) return false;
  const ids = new Set<string>();
  const accounts = new Set<string>();
  return candidate.sellers.every((seller) => {
    if (!seller || typeof seller !== 'object') return false;
    const input = validateInput(seller as Seller);
    const id = clean((seller as Seller).id);
    const color = clean((seller as Seller).color).toUpperCase();
    if (!input.ok || !id || ids.has(id) || accounts.has(input.value.accountCopy) || !HEX_COLOR.test(color)) return false;
    ids.add(id);
    accounts.add(input.value.accountCopy);
    return true;
  });
}

export function loadLocalConfig(storage: StorageLike): AppConfig | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== 'object' || (stored as { version?: unknown }).version !== 1) return null;
    const config = (stored as { config?: unknown }).config;
    return isAppConfig(config) ? config : null;
  } catch {
    return null;
  }
}

export function saveLocalConfig(storage: StorageLike, config: AppConfig): boolean {
  if (!isAppConfig(config)) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, config }));
    return true;
  } catch {
    return false;
  }
}
