export type SellerId = '1' | '2';

export type Seller = {
  id: SellerId;
  label: string;
  color: string;
  bank: string;
  holder: string;
  accountDisplay: string;
  accountCopy: string;
};

export type AppConfig = {
  shopName: string;
  sellers: Seller[];
};

export type ConfigResult =
  | { ok: true; value: AppConfig }
  | { ok: false; message: string };

type EnvSource = Record<string, unknown>;

const CONFIG_ERROR = '계좌 설정이 필요합니다. 관리자에게 알려 주세요.';
const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const ACCOUNT_DISPLAY = /^[0-9 -]+$/;

function text(env: EnvSource, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isConfigured(value: string): boolean {
  if (!value) return false;
  const upper = value.toUpperCase();
  return upper !== 'TODO' && !/^(은행명|예금주|계좌번호)\s*[12]$/.test(value);
}

function sellerFromEnv(env: EnvSource, id: SellerId): Seller | null {
  const prefix = `VITE_USER${id}_`;
  const label = text(env, `${prefix}LABEL`);
  const color = text(env, `${prefix}COLOR`).toUpperCase();
  const bank = text(env, `${prefix}BANK`);
  const holder = text(env, `${prefix}HOLDER`);
  const accountDisplay = text(env, `${prefix}ACCOUNT`);
  const accountCopy = accountDisplay.replace(/\D/g, '');

  if (
    ![label, bank, holder, accountDisplay].every(isConfigured) ||
    !HEX_COLOR.test(color) ||
    !ACCOUNT_DISPLAY.test(accountDisplay) ||
    accountCopy.length < 8 ||
    accountCopy.length > 20
  ) {
    return null;
  }

  return { id, label, color, bank, holder, accountDisplay, accountCopy };
}

export function loadAppConfig(env: EnvSource): ConfigResult {
  const shopName = text(env, 'VITE_SHOP_NAME');
  const first = sellerFromEnv(env, '1');
  const second = sellerFromEnv(env, '2');

  if (
    !isConfigured(shopName) ||
    !first ||
    (second !== null && first.color === second.color)
  ) {
    return { ok: false, message: CONFIG_ERROR };
  }

  return {
    ok: true,
    value: { shopName, sellers: second ? [first, second] : [first] },
  };
}

export function getSeller(config: AppConfig, id: string | null): Seller | null {
  return config.sellers.find((seller) => seller.id === id) ?? null;
}

export function readAppConfig(): ConfigResult {
  return loadAppConfig(import.meta.env);
}
