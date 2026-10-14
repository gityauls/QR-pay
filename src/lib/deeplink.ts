import type { BankOption } from './banks';

export function buildAndroidBankLink(bank: BankOption): string {
  const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(bank.androidPackage)}`;
  return `intent://#Intent;package=${bank.androidPackage};S.browser_fallback_url=${encodeURIComponent(storeUrl)};end`;
}

export function buildTossLink(payment: {
  bank: string;
  accountNo: string;
  amount: number;
}, fallbackUrl?: string): string {
  const compactBank = payment.bank.replace(/\s+/g, '');
  const bankAliases: Record<string, string> = {
    'NH농협': '농협',
    'NH농협은행': '농협',
    '농협은행': '농협',
    'KB국민': '국민',
    'KB국민은행': '국민',
    '국민은행': '국민',
    '신한은행': '신한',
    '우리은행': '우리',
    '하나은행': '하나',
    'IBK기업': '기업',
    'IBK기업은행': '기업',
    '기업은행': '기업',
  };
  const params = new URLSearchParams({
    bank: bankAliases[compactBank] ?? compactBank.replace(/은행$/, ''),
    accountNo: payment.accountNo.replace(/\D/g, ''),
    amount: String(payment.amount),
  });

  const storeUrl = 'https://play.google.com/store/apps/details?id=viva.republica.toss';
  const fallback = encodeURIComponent(fallbackUrl ?? storeUrl);
  return `intent://send?${params.toString()}#Intent;scheme=supertoss;package=viva.republica.toss;S.browser_fallback_url=${fallback};end`;
}
