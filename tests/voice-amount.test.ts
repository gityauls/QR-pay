import { describe, expect, it } from 'vitest';
import { parseSpokenAmount } from '../src/lib/voice-amount';

describe('spoken amount', () => {
  it.each([
    ['만오천원', 15_000],
    ['만 육천 원', 16_000],
    ['1만 5천원', 15_000],
    ['1만5천원', 15_000],
    ['15,000원', 15_000],
    ['15000', 15_000],
    ['만 5,000원', 15_000],
    ['삼만 오천 원', 35_000],
    ['3만 원', 30_000],
    ['이십만원', 200_000],
    ['십오만 원', 150_000],
    ['오십만원', 500_000],
    ['오천오백원', 5_500],
    ['삼만오천오백원', 35_500],
    ['천원', 1_000],
    ['만원', 10_000],
    ['칠천 원이요', 7_000],
    ['만오천원입니다', 15_000],
    ['₩12,000', 12_000],
  ])('hears %s as %i won', (spoken, expected) => {
    expect(parseSpokenAmount(spoken)).toBe(expected);
  });

  it.each(['', '   ', '안녕하세요', '만오천원 주세요 감사', '1.5만', '오오천'])('rejects %s', (spoken) => {
    expect(parseSpokenAmount(spoken)).toBeNull();
  });
});
