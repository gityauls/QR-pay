import type { SellerId } from '../config';
import { parseAmount } from './money';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type SaleRecord = {
  occurredAt: string;
  sellerId: SellerId;
  amount: number;
};

export type SalesSummary = {
  count: number;
  total: number;
  entries: SaleRecord[];
};

const CURRENT_SELLER_KEY = 'qrpay.currentSeller';
const SALES_KEY = 'qrpay.sales';
const MAX_SALES = 500;

export function loadCurrentSeller(storage: StorageLike): SellerId | null {
  try {
    const value = storage.getItem(CURRENT_SELLER_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function saveCurrentSeller(
  storage: StorageLike,
  sellerId: SellerId,
): boolean {
  try {
    storage.setItem(CURRENT_SELLER_KEY, sellerId);
    return true;
  } catch {
    return false;
  }
}

function isSaleRecord(value: unknown): value is SaleRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SaleRecord>;
  return (
    typeof candidate.sellerId === 'string' &&
    candidate.sellerId.trim().length > 0 &&
    typeof candidate.occurredAt === 'string' &&
    Number.isFinite(Date.parse(candidate.occurredAt)) &&
    parseAmount(candidate.amount ?? '') !== null
  );
}

export function getSales(storage: StorageLike): SaleRecord[] {
  try {
    const raw = storage.getItem(SALES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSaleRecord).slice(-MAX_SALES) : [];
  } catch {
    return [];
  }
}

export function recordSale(storage: StorageLike, sale: SaleRecord): boolean {
  if (!isSaleRecord(sale)) return false;

  try {
    const next = [...getSales(storage), sale].slice(-MAX_SALES);
    storage.setItem(SALES_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getTodaySummary(
  sales: SaleRecord[],
  now = new Date(),
): SalesSummary {
  const entries = sales
    .filter((sale) => isSameLocalDay(new Date(sale.occurredAt), now))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return {
    count: entries.length,
    total: entries.reduce((sum, sale) => sum + sale.amount, 0),
    entries,
  };
}
