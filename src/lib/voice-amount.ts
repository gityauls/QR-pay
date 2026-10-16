const DIGITS: Record<string, number> = {
  영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 륙: 6, 칠: 7, 팔: 8, 구: 9,
};
const SMALL_UNITS: Record<string, number> = { 십: 10, 백: 100, 천: 1_000 };
const NUMBER_TEXT = /^[0-9영공일이삼사오육륙칠팔구십백천만]+$/;
// Polite endings people add after a price: "칠천 원이요", "만오천원입니다".
const ENDING = /원?(이요|이에요|입니다|예요|요)?$/;

// Turns what the speech recognizer heard ("만오천원", "1만 5천 원", "15,000원") into won.
export function parseSpokenAmount(spoken: string): number | null {
  const text = spoken.replace(/[\s,₩]/g, '').replace(ENDING, '');
  if (!text || !NUMBER_TEXT.test(text)) return null;

  let total = 0;
  let section = 0;
  let pending: number | null = null;
  for (let index = 0; index < text.length;) {
    const char = text[index];
    const arabic = /^[0-9]+/.exec(text.slice(index));
    if (arabic || char in DIGITS) {
      // Two numbers in a row ("오오천") is not a price.
      if (pending !== null) return null;
      pending = arabic ? Number(arabic[0]) : DIGITS[char];
      index += arabic ? arabic[0].length : 1;
      continue;
    }
    if (char in SMALL_UNITS) {
      section += (pending ?? 1) * SMALL_UNITS[char];
    } else {
      section += pending ?? 0;
      total += (section || 1) * 10_000;
      section = 0;
    }
    pending = null;
    index += 1;
  }
  const amount = total + section + (pending ?? 0);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
