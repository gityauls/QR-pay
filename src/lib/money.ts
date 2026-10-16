export const MAX_AMOUNT = 500_000;

// Sellers choose 1,000-won steps (default) or 100-won steps; customers accept either.
export type AmountStep = 100 | 1_000;
export const DEFAULT_STEP: AmountStep = 1_000;
export const FINEST_STEP: AmountStep = 100;

export function parseAmount(value: string | number, step: AmountStep = DEFAULT_STEP): number | null {
  const normalized = String(value).replaceAll(',', '').trim();
  if (!/^\d+$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount)) return null;
  if (
    amount < step ||
    amount > MAX_AMOUNT ||
    amount % step !== 0
  ) return null;
  return amount;
}

export function formatWon(amount: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(amount)}원`;
}

export function formatWonWords(amount: number): string {
  if (!Number.isInteger(amount) || amount <= 0) return '';

  const parts: string[] = [];
  const man = Math.floor(amount / 10_000);
  const remainder = amount % 10_000;
  const thousand = Math.floor(remainder / 1_000);
  const hundred = Math.floor((remainder % 1_000) / 100);
  const tail = remainder % 100;

  if (man > 0) parts.push(`${man}만`);
  if (thousand > 0) parts.push(`${thousand}천`);
  if (hundred > 0) parts.push(`${hundred}백`);
  if (tail > 0) parts.push(String(tail));

  return `${parts.join(' ')}원`;
}
