import type { Seller } from '../config';
import { parseAmount } from './money';

export type PaymentRequest =
  | { ok: true; shopName: string; seller: Seller; amount: number }
  | { ok: false; message: string };

const INVALID_QR_MESSAGE =
  '이 QR로는 송금할 수 없습니다. 판매자에게 새 QR을 요청해 주세요.';
const HEX_COLOR = /^#[0-9A-F]{6}$/i;
const ACCOUNT_DISPLAY = /^[0-9 -]+$/;

type PaymentPayload = {
  v: 1;
  shop: string;
  seller: Seller;
  amount: number;
};

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isShortText(value: unknown, max = 100): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isSeller(value: unknown): value is Seller {
  if (!value || typeof value !== 'object') return false;
  const seller = value as Partial<Seller>;
  if (
    !isShortText(seller.id) ||
    !isShortText(seller.label) ||
    !isShortText(seller.bank) ||
    !isShortText(seller.holder) ||
    !isShortText(seller.accountDisplay, 40) ||
    typeof seller.color !== 'string' ||
    !HEX_COLOR.test(seller.color) ||
    !ACCOUNT_DISPLAY.test(seller.accountDisplay)
  ) return false;
  const accountCopy = seller.accountDisplay.replace(/\D/g, '');
  return accountCopy.length >= 8 && accountCopy.length <= 20 && seller.accountCopy === accountCopy;
}

export function buildPayUrl(
  baseUrl: string,
  shopName: string,
  seller: Seller,
  amount: number,
): string {
  const validAmount = parseAmount(amount);
  if (validAmount === null) throw new Error('올바른 금액이 아닙니다.');
  if (!isShortText(shopName) || !isSeller(seller)) throw new Error('올바른 받는 분 정보가 아닙니다.');

  const payload: PaymentPayload = { v: 1, shop: shopName.trim(), seller, amount: validAmount };
  const url = new URL('pay/', baseUrl);
  url.hash = toBase64Url(JSON.stringify(payload));
  return url.toString();
}

export function parsePaymentRequest(hash: string): PaymentRequest {
  try {
    const encoded = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!encoded || encoded.length > 4_000) throw new Error('missing or oversized payload');
    const payload: unknown = JSON.parse(fromBase64Url(encoded));
    if (!payload || typeof payload !== 'object') throw new Error('invalid payload');
    const candidate = payload as Partial<PaymentPayload>;
    const amount = parseAmount(candidate.amount ?? '');
    if (candidate.v !== 1 || !isShortText(candidate.shop) || !isSeller(candidate.seller) || amount === null) {
      throw new Error('invalid payload');
    }
    return {
      ok: true,
      shopName: candidate.shop.trim(),
      seller: candidate.seller,
      amount,
    };
  } catch {
    return { ok: false, message: INVALID_QR_MESSAGE };
  }
}
