import { nonghyupKind, type BankOption } from './banks';

export function buildAndroidBankLink(bank: BankOption): string {
  const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(bank.androidPackage)}`;
  return `intent://#Intent;package=${bank.androidPackage};S.browser_fallback_url=${encodeURIComponent(storeUrl)};end`;
}

type TossPayment = {
  bank: string;
  accountNo: string;
  amount: number;
};

function tossParams(payment: TossPayment): URLSearchParams {
  const compactBank = payment.bank.replace(/\s+/g, '');
  const bankAliases: Record<string, string> = {
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
  // Toss has no confirmed name for local 농·축협; 농협 reaches both through the shared network.
  const bank = nonghyupKind(compactBank)
    ? '농협'
    : bankAliases[compactBank] ?? compactBank.replace(/은행$/, '');
  return new URLSearchParams({
    bank,
    accountNo: payment.accountNo.replace(/\D/g, ''),
    amount: String(payment.amount),
  });
}

export function buildTossLink(payment: TossPayment, fallbackUrl?: string): string {
  const params = tossParams(payment);
  const storeUrl = 'https://play.google.com/store/apps/details?id=viva.republica.toss';
  const fallback = encodeURIComponent(fallbackUrl ?? storeUrl);
  return `intent://send?${params.toString()}#Intent;scheme=supertoss;package=viva.republica.toss;S.browser_fallback_url=${fallback};end`;
}

// iOS Safari rejects Android intent:// links, so iPhone opens Toss by its own scheme.
export function buildIosTossLink(payment: TossPayment): string {
  return `supertoss://send?${tossParams(payment).toString()}`;
}
