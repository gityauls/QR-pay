import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../src/lib/storage';
import {
  addSeller,
  createLocalConfig,
  deleteSeller,
  loadLocalConfig,
  saveLocalConfig,
  updateSeller,
} from '../src/lib/local-config';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const first = {
  label: '장인어른',
  bank: 'NH농협은행',
  holder: '홍길동',
  accountDisplay: '123-456-7890',
};

describe('local seller configuration', () => {
  it('creates a shop with an arbitrary id and automatic color', () => {
    const result = createLocalConfig('김선비 벌꿀', first, () => 'seller-a');
    expect(result).toEqual({
      ok: true,
      value: {
        shopName: '김선비 벌꿀',
        sellers: [{
          id: 'seller-a', label: '장인어른', color: '#155E75', bank: 'NH농협은행',
          holder: '홍길동', accountDisplay: '123-456-7890', accountCopy: '1234567890',
        }],
      },
    });
  });

  it('assigns the next unused color and blocks duplicate accounts', () => {
    const created = createLocalConfig('상점', first, () => 'one');
    if (!created.ok) throw new Error('fixture failed');
    const added = addSeller(created.value, {
      label: '장모님', bank: '신한', holder: '김영희', accountDisplay: '987 654 3210',
    }, () => 'two');
    expect(added.ok && added.value.sellers[1].color).toBe('#9A3412');

    const duplicate = addSeller(created.value, { ...first, label: '중복' }, () => 'three');
    expect(duplicate).toEqual({ ok: false, message: '이미 등록된 계좌번호입니다.' });
  });

  it('updates a seller but never changes its assigned color', () => {
    const created = createLocalConfig('상점', first, () => 'one');
    if (!created.ok) throw new Error('fixture failed');
    const updated = updateSeller(created.value, 'one', { ...first, label: '수정 이름' });
    expect(updated.ok && updated.value.sellers[0]).toMatchObject({
      id: 'one', label: '수정 이름', color: '#155E75',
    });
  });

  it('prevents deleting the final seller', () => {
    const created = createLocalConfig('상점', first, () => 'one');
    if (!created.ok) throw new Error('fixture failed');
    expect(deleteSeller(created.value, 'one')).toEqual({
      ok: false,
      message: '받는 분을 한 명 이상 유지해 주세요.',
    });
  });

  it.each([
    ['', first, '판매점 이름을 입력해 주세요.'],
    ['상점', { ...first, label: '' }, '받는 분 이름을 입력해 주세요.'],
    ['상점', { ...first, accountDisplay: '123-ABC' }, '계좌번호는 숫자, 공백, 하이픈만 입력해 주세요.'],
  ])('validates required setup values', (shopName, seller, message) => {
    expect(createLocalConfig(shopName, seller, () => 'one')).toEqual({ ok: false, message });
  });

  it('rejects unreasonably long shop and recipient names', () => {
    expect(createLocalConfig('가'.repeat(61), first, () => 'one')).toEqual({
      ok: false, message: '판매점 이름은 60자 이내로 입력해 주세요.',
    });
    expect(createLocalConfig('상점', { ...first, label: '가'.repeat(41) }, () => 'one')).toEqual({
      ok: false, message: '받는 분 이름은 40자 이내로 입력해 주세요.',
    });
  });

  it('saves, reloads, and rejects damaged local data', () => {
    const storage = new MemoryStorage();
    const created = createLocalConfig('상점', first, () => 'one');
    if (!created.ok) throw new Error('fixture failed');
    expect(saveLocalConfig(storage, created.value)).toBe(true);
    expect(loadLocalConfig(storage)).toEqual(created.value);
    storage.setItem('qrpay.localConfig', '{broken');
    expect(loadLocalConfig(storage)).toBeNull();
  });
});
