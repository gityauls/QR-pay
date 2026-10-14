import { describe, expect, it } from 'vitest';
import { PRIMARY_BANKS } from '../src/lib/banks';
import { buildAndroidBankLink, buildTossLink } from '../src/lib/deeplink';

describe('bank deep links', () => {
  it('builds an Android intent for the selected bank app', () => {
    const nh = PRIMARY_BANKS[0];
    const link = buildAndroidBankLink(nh);

    expect(link).toContain('intent://');
    expect(link).toContain(`package=${nh.androidPackage}`);
    expect(link).toContain('play.google.com');
  });

  it('builds a Toss transfer link with encoded payment details', () => {
    const link = buildTossLink({
      bank: '농협은행',
      accountNo: '123-456-7890',
      amount: 14_000,
    }, 'https://example.com/QR-pay/pay/?u=1&a=14000#toss-help');

    expect(link).toContain('intent://send?');
    expect(link).toContain('scheme=supertoss');
    expect(link).toContain('package=viva.republica.toss');
    expect(link).toContain(encodeURIComponent('농협'));
    expect(link).toContain('accountNo=1234567890');
    expect(link).toContain('amount=14000');
    expect(link).toContain('browser_fallback_url=');
  });
});
