import { describe, expect, it } from 'vitest';
import {
  getSales,
  getTodaySummary,
  loadCurrentSeller,
  recordSale,
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
    expect(saveCurrentSeller(storage, '2')).toBe(true);
    expect(loadCurrentSeller(storage)).toBe('2');
  });

  it('ignores a damaged seller id', () => {
    const storage = new MemoryStorage();
    storage.setItem('qrpay.currentSeller', '3');
    expect(loadCurrentSeller(storage)).toBeNull();
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
        amount: 100,
      }),
    ).toBe(false);
  });
});
