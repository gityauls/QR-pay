import { describe, expect, it } from 'vitest';
import { getSeller, type AppConfig } from '../src/config';

const config: AppConfig = {
  shopName: '행사 판매점',
  sellers: [{
    id: 'seller-arbitrary-id', label: '사용자', color: '#155E75', bank: '신한은행',
    holder: '홍길동', accountDisplay: '123-456-7890', accountCopy: '1234567890',
  }],
};

describe('getSeller', () => {
  it('finds an arbitrary locally generated seller id', () => {
    expect(getSeller(config, 'seller-arbitrary-id')?.holder).toBe('홍길동');
  });

  it('returns null for unknown or empty ids', () => {
    expect(getSeller(config, 'missing')).toBeNull();
    expect(getSeller(config, null)).toBeNull();
  });
});
