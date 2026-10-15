export type BankOption = {
  id: string;
  label: string;
  shortLabel: string;
  androidPackage: string;
  kind: 'bank' | 'toss';
};

export const SETUP_BANKS = [
  'NH농협은행', '지역농·축협', 'KB국민은행', '신한은행', '우리은행', '하나은행',
  'IBK기업은행', '카카오뱅크', '토스뱅크', '케이뱅크', '새마을금고', '우체국', '수협',
] as const;

// NH농협은행 and local 농·축협 (e.g. 서산농협) are separate institutions on one shared network.
export function nonghyupKind(bankName: string): 'bank' | 'local' | null {
  const compact = bankName.replace(/\s+/g, '');
  if (/^(NH)?농협(은행)?$/i.test(compact)) return 'bank';
  if (/농협|축협|농축협/.test(compact)) return 'local';
  return null;
}

export const PRIMARY_BANKS: readonly BankOption[] = [
  {
    id: 'nh',
    label: 'NH농협',
    shortLabel: '농협',
    androidPackage: 'nh.smart.banking',
    kind: 'bank',
  },
  {
    id: 'kb',
    label: 'KB국민',
    shortLabel: '국민',
    androidPackage: 'com.kbstar.kbbank',
    kind: 'bank',
  },
  {
    id: 'shinhan',
    label: '신한',
    shortLabel: '신한',
    androidPackage: 'com.shinhan.sbanking',
    kind: 'bank',
  },
  {
    id: 'woori',
    label: '우리',
    shortLabel: '우리',
    androidPackage: 'com.wooribank.smart.npib',
    kind: 'bank',
  },
  {
    id: 'hana',
    label: '하나',
    shortLabel: '하나',
    androidPackage: 'com.hanabank.oqf',
    kind: 'bank',
  },
  {
    id: 'ibk',
    label: 'IBK기업',
    shortLabel: '기업',
    androidPackage: 'com.ibk.android.ionebank',
    kind: 'bank',
  },
  {
    id: 'kakao',
    label: '카카오뱅크',
    shortLabel: '카카오',
    androidPackage: 'com.kakaobank.channel',
    kind: 'bank',
  },
  {
    id: 'toss',
    label: '토스',
    shortLabel: '토스',
    androidPackage: 'viva.republica.toss',
    kind: 'toss',
  },
] as const;

export const OTHER_BANKS: readonly BankOption[] = [
  {
    id: 'kbank',
    label: '케이뱅크',
    shortLabel: '케이뱅크',
    androidPackage: 'com.kbankwith.smartbank',
    kind: 'bank',
  },
  {
    id: 'mg',
    label: '새마을금고',
    shortLabel: '새마을',
    androidPackage: 'com.smg.spbs',
    kind: 'bank',
  },
  {
    id: 'post',
    label: '우체국',
    shortLabel: '우체국',
    androidPackage: 'com.epost.psf.sdsi',
    kind: 'bank',
  },
  {
    id: 'suhyup',
    label: '수협',
    shortLabel: '수협',
    androidPackage: 'com.suhyup.psmb',
    kind: 'bank',
  },
] as const;
