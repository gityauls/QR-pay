import type { SellerId } from '../config';
import { parseAmount } from './money';

export type PaymentRequest =
  | { ok: true; sellerId: SellerId; amount: number }
  | { ok: false; message: string };

const INVALID_QR_MESSAGE =
  '이 QR로는 송금할 수 없습니다. 판매자에게 새 QR을 요청해 주세요.';

export function buildPayUrl(
  baseUrl: string,
  sellerId: SellerId,
  amount: number,
): string {
  const validAmount = parseAmount(amount);
  if (validAmount === null) throw new Error('올바른 금액이 아닙니다.');

  const url = new URL('pay/', baseUrl);
  url.searchParams.set('u', sellerId);
  url.searchParams.set('a', String(validAmount));
  return url.toString();
}

export function parsePaymentRequest(search: string): PaymentRequest {
  const params = new URLSearchParams(search);
  const sellerId = params.get('u');
  const amount = parseAmount(params.get('a') ?? '');

  if ((sellerId !== '1' && sellerId !== '2') || amount === null) {
    return { ok: false, message: INVALID_QR_MESSAGE };
  }

  return { ok: true, sellerId, amount };
}
