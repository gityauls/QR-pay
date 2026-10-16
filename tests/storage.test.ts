import { describe, expect, it } from 'vitest';
import {
  getSales,
  getTodaySummary,
  loadAmountStep,
  loadCurrentSeller,
  recordSale,
  saveAmountStep,
  saveCurrentSeller,
  type StorageLike,
} from '../src/lib/storage';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('current seller storage', () => {
  it('stores and restores a valid seller id', () => {
    const storage = new MemoryStorage();
    expect(saveCurrentSeller(storage, 'seller-a')).toBe(true);
    expect(loadCurrentSeller(storage)).toBe('seller-a');
  });

  it('ignores a damaged seller id', () => {
    const storage = new MemoryStorage();
    storage.setItem('qrpay.currentSeller', '');
    expect(loadCurrentSeller(storage)).toBeNull();
  });
});

describe('amount step storage', () => {
  it('uses 1,000-won steps until 100-won input is turned on', () => {
    const storage = new MemoryStorage();
    expect(loadAmountStep(storage)).toBe(1_000);
    expect(saveAmountStep(storage, 100)).toBe(true);
    expect(loadAmountStep(storage)).toBe(100);
    expect(saveAmountStep(storage, 1_000)).toBe(true);
    expect(loadAmountStep(storage)).toBe(1_000);
  });

  it('falls back to 1,000-won steps for damaged values', () => {
    const storage = new MemoryStorage();
    storage.setItem('qrpay.amountStep', '7');
    expect(loadAmountStep(storage)).toBe(1_000);
  });

  it('keeps 100-won sales in the daily record', () => {
    const storage = new MemoryStorage();
    recordSale(storage, { occurredAt: '2026-10-16T03:00:00.000Z', sellerId: 'seller-a', amount: 15_500 });
    expect(getSales(storage).map((sale) => sale.amount)).toEqual([15_500]);
  });
});

describe('sales storage', () => {
  it('records a confirmed sale and calculates only today', () => {
    const storage = new MemoryStorage();
    expect(
      recordSale(storage, {
        occurredAt: '2026-10-13T09:00:00+09:00',
        sellerId: '1',
        amount: 45_000,
      }),
    ).toBe(true);
    expect(
      recordSale(storage, {
        occurredAt: '2026-10-12T23:00:00+09:00',
        sellerId: '2',
        amount: 10_000,
      }),
    ).toBe(true);

    const summary = getTodaySummary(
      getSales(storage),
      new Date('2026-10-13T15:00:00+09:00'),
    );
    expect(summary.count).toBe(1);
    expect(summary.total).toBe(45_000);
    expect(summary.entries[0].sellerId).toBe('1');
  });

  it('recovers from malformed saved JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem('qrpay.sales', '{broken');
    expect(getSales(storage)).toEqual([]);
  });

  it('keeps the payment flow usable when storage throws', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadCurrentSeller(storage)).toBeNull();
    expect(getSales(storage)).toEqual([]);
    expect(
      recordSale(storage, {
        occurredAt: '2026-10-13T09:00:00+09:00',
        sellerId: '1',
        amount: 1_000,
      }),
    ).toBe(false);
  });
});
