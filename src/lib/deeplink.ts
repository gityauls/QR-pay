import type { BankOption } from './banks';

export function buildAndroidBankLink(bank: BankOption): string {
  const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(bank.androidPackage)}`;
  return `intent://#Intent;package=${bank.androidPackage};S.browser_fallback_url=${encodeURIComponent(storeUrl)};end`;
}

export function buildTossLink(payment: {
  bank: string;
  accountNo: string;
  amount: number;
}): string {
  const params = new URLSearchParams({
    bank: payment.bank,
    accountNo: payment.accountNo.replace(/\D/g, ''),
    amount: String(payment.amount),
  });

  return `supertoss://send?${params.toString()}`;
}
