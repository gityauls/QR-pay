# Mobile PWA QR Transfer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing static QR transfer MVP into a high-contrast Samsung Android PWA with a large in-app keypad, 15-second automatic turnover, major-bank launch buttons, and a Toss-prefill attempt with safe copy fallback.

**Architecture:** Keep the existing Vite multi-page TypeScript app and GitHub Pages deployment. Add small pure modules for keypad state, bank catalog/deep links, and PWA registration; keep seller and customer DOM rendering dependency-injected so Vitest can exercise behavior without a browser server. Store seller choice and QR-generation records only in localStorage.

**Tech Stack:** Vite 8, TypeScript, Vitest/jsdom, `qrcode`, Web App Manifest, service worker, GitHub Pages

---

## File map

- `src/lib/money.ts`: validate 1,000-won increments and format Korean amounts.
- `src/lib/keypad.ts`: pure digit-entry state transitions for the seller keypad.
- `src/lib/banks.ts`: ordered bank catalog and Android app-launch URLs.
- `src/lib/deeplink.ts`: Toss transfer link and safe launch/fallback orchestration.
- `src/seller/main.ts`: seller selection, keypad, QR countdown, automatic record/reset, settings and records.
- `src/pay/main.ts`: customer amount/account view and bank selection.
- `src/pwa.ts`: service-worker registration.
- `src/styles.css`: high-contrast, phone-first visual system.
- `public/manifest.webmanifest`: install metadata.
- `public/sw.js`: same-origin app-shell cache.
- `public/icons/qr-pay-192.png`, `public/icons/qr-pay-512.png`: Android home-screen icons.
- `index.html`, `pay/index.html`: PWA and security metadata.
- `README.md`, `docs/처음-실행하기.md`: developer and nontechnical-user setup instructions.

### Task 1: Enforce event amount rules

**Files:**
- Modify: `tests/money.test.ts`
- Modify: `src/lib/money.ts`
- Modify: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing amount tests**

Change valid cases to `1,000`, `14,000`, and `500,000`, and rejected cases to include `100`, `1,100`, `14,500`, and `500,001`:

```ts
it.each([
  ['1000', 1_000],
  ['14,000', 14_000],
  ['500000', 500_000],
])('parses valid thousand-won input %s', (input, expected) => {
  expect(parseAmount(input)).toBe(expected);
});

it.each(['', '100', '1100', '14500', '500001', '1.5', 'abc', '-1000']) (
  'rejects invalid amount %s',
  (input) => expect(parseAmount(input)).toBeNull(),
);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm.cmd run test:run -- tests/money.test.ts tests/storage.test.ts`

Expected: failures because `100` is still accepted and stored.

- [ ] **Step 3: Implement the minimum amount rule**

Set `MIN_AMOUNT` to `1_000` and reject `amount % 1_000 !== 0` in `parseAmount`.

```ts
export const MIN_AMOUNT = 1_000;
export const MAX_AMOUNT = 500_000;

if (amount < MIN_AMOUNT || amount > MAX_AMOUNT || amount % 1_000 !== 0) return null;
```

- [ ] **Step 4: Update storage fixtures to valid 1,000-won values and run tests**

Run: `npm.cmd run test:run -- tests/money.test.ts tests/storage.test.ts`

Expected: both files pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/money.ts tests/money.test.ts tests/storage.test.ts
git commit -m "feat: enforce thousand-won payment amounts"
```

### Task 2: Add a deterministic large keypad

**Files:**
- Create: `src/lib/keypad.ts`
- Create: `tests/keypad.test.ts`

- [ ] **Step 1: Write failing keypad tests**

```ts
import { applyKey, type KeypadKey } from '../src/lib/keypad';

it.each<[string, KeypadKey, string]>([
  ['', '1', '1'],
  ['14', '0', '140'],
  ['14000', 'backspace', '1400'],
  ['14000', 'clear', ''],
  ['500000', '0', '500000'],
])('%s + %s -> %s', (current, key, expected) => {
  expect(applyKey(current, key)).toBe(expected);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm.cmd run test:run -- tests/keypad.test.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement keypad state**

```ts
import { MAX_AMOUNT } from './money';

export type KeypadKey = `${0|1|2|3|4|5|6|7|8|9}` | 'backspace' | 'clear';

export function applyKey(current: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'backspace') return current.slice(0, -1);
  const next = `${current}${key}`.replace(/^0+/, '');
  if (!next) return '';
  return Number(next) > MAX_AMOUNT ? current : next;
}
```

- [ ] **Step 4: Run and confirm GREEN**

Run: `npm.cmd run test:run -- tests/keypad.test.ts`

Expected: all keypad cases pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/keypad.ts tests/keypad.test.ts
git commit -m "feat: add accessible amount keypad state"
```

### Task 3: Rebuild the seller flow and automatic turnover

**Files:**
- Modify: `tests/seller-view.test.ts`
- Modify: `src/seller/main.ts`

- [ ] **Step 1: Write failing seller-view tests**

Add timer injection to seller dependencies and assert these behaviors:

```ts
const timers = { set: vi.fn((callback: () => void) => { callback(); return 1; }), clear: vi.fn() };

expect(element.textContent).toContain('현재 받는 분');
expect(element.textContent).toContain('NH농협');
expect(element.textContent).toContain('123-456-7890');
expect(element.querySelectorAll('[data-keypad-key]')).toHaveLength(12);

button(element, '1').click();
button(element, '4').click();
button(element, '0').click();
button(element, '0').click();
button(element, '0').click();
expect(element.textContent).toContain('14,000원');
expect(element.textContent).toContain('1만 4천원');

button(element, 'QR 만들기').click();
await vi.waitFor(() => expect(makeQr).toHaveBeenCalledOnce());
expect(JSON.parse(localStorage.getItem('qrpay.sales') ?? '[]')).toHaveLength(1);
expect(timers.set).toHaveBeenCalledWith(expect.any(Function), 15_000);
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm.cmd run test:run -- tests/seller-view.test.ts`

Expected: no keypad buttons and no automatic record/reset timer.

- [ ] **Step 3: Implement the seller UI**

Replace the native input with a read-only amount display and a 3-column keypad in this order:

```ts
const keys = ['1','2','3','4','5','6','7','8','9','clear','0','backspace'] as const;
```

Use `applyKey`, `parseAmount`, `formatWon`, and `formatWonWords`. The header must render seller label prominently and `bank + accountDisplay` beneath it. Keep settings/records behind one `설정` button. On QR creation, call `recordSale` once, show the QR and countdown, then call `renderAmount()` after 15,000 ms. Clear the timer whenever another view replaces the QR view.

- [ ] **Step 4: Run and confirm GREEN**

Run: `npm.cmd run test:run -- tests/seller-view.test.ts`

Expected: seller tests pass with fake timers and no manual confirmation button.

- [ ] **Step 5: Commit**

```powershell
git add src/seller/main.ts tests/seller-view.test.ts
git commit -m "feat: streamline seller keypad and QR turnover"
```

### Task 4: Add ordered bank options and safe app links

**Files:**
- Create: `src/lib/banks.ts`
- Create: `src/lib/deeplink.ts`
- Create: `tests/banks.test.ts`
- Create: `tests/deeplink.test.ts`

- [ ] **Step 1: Write failing bank-order tests**

```ts
expect(PRIMARY_BANKS.map((bank) => bank.label)).toEqual([
  'NH농협', 'KB국민', '신한', '우리', '하나', 'IBK기업', '카카오뱅크', '토스',
]);
expect(OTHER_BANKS.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Write failing deep-link tests**

```ts
expect(buildTossLink('NH농협', '123-456-7890', 14_000)).toContain(
  'bank=NH%EB%86%8D%ED%98%91&accountNo=1234567890&amount=14000',
);
expect(buildAndroidBankLink(PRIMARY_BANKS[0])).toContain('package=nh.smart.banking');
```

- [ ] **Step 3: Run and confirm RED**

Run: `npm.cmd run test:run -- tests/banks.test.ts tests/deeplink.test.ts`

Expected: both modules are missing.

- [ ] **Step 4: Implement the catalogs and links**

Define:

```ts
export type BankOption = {
  id: string;
  label: string;
  shortLabel: string;
  androidPackage: string;
  kind: 'bank' | 'toss';
};
```

The first eight entries must match the approved order. Use Android package intents with a Play Store browser fallback for general banks. Build Toss with `supertoss://send` parameters and numeric account digits. Keep all link building pure; DOM navigation belongs in `pay/main.ts`.

- [ ] **Step 5: Run and confirm GREEN**

Run: `npm.cmd run test:run -- tests/banks.test.ts tests/deeplink.test.ts`

Expected: order and URL tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/banks.ts src/lib/deeplink.ts tests/banks.test.ts tests/deeplink.test.ts
git commit -m "feat: add Korean bank and Toss launch links"
```

### Task 5: Rebuild the customer bank-selection screen

**Files:**
- Modify: `tests/pay-view.test.ts`
- Modify: `src/pay/main.ts`

- [ ] **Step 1: Write failing customer-flow tests**

Extend dependencies with `open(url: string): void`. Assert:

```ts
expect([...element.querySelectorAll('[data-bank-id]')].map((node) => node.textContent)).toEqual([
  'NH농협', 'KB국민', '신한', '우리', '하나', 'IBK기업', '카카오뱅크', '토스',
]);

button(element, 'NH농협').click();
await vi.waitFor(() => expect(copy).toHaveBeenCalledWith('1234567890'));
expect(open).toHaveBeenCalledWith(expect.stringContaining('nh.smart.banking'));

button(element, '다른 은행 보기').click();
expect(element.querySelector('[data-bank-id="kbank"]')).not.toBeNull();
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm.cmd run test:run -- tests/pay-view.test.ts`

Expected: bank buttons are absent.

- [ ] **Step 3: Implement the customer flow**

Render amount, Korean words, bank, holder, and full account. Render the primary banks in approved order and an expandable `다른 은행 보기`. For a general bank: copy first, report `계좌번호를 복사했습니다`, then open the Android intent. For Toss: copy first, then open the prefilled Toss URL. If copy fails, keep the account visible and tell the customer to press and hold it.

- [ ] **Step 4: Run and confirm GREEN**

Run: `npm.cmd run test:run -- tests/pay-view.test.ts`

Expected: all customer tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/pay/main.ts tests/pay-view.test.ts
git commit -m "feat: add customer bank app selection"
```

### Task 6: Apply the high-contrast mobile visual system

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/seller-view.test.ts`
- Modify: `tests/pay-view.test.ts`

- [ ] **Step 1: Add failing semantic/class assertions**

Assert the seller view has `.app-header`, `.amount-display`, `.keypad`, and `.primary-action`, and the customer view has `.bank-grid`, `.account-panel`, and one visible `h1`.

- [ ] **Step 2: Run and confirm RED**

Run: `npm.cmd run test:run -- tests/seller-view.test.ts tests/pay-view.test.ts`

Expected: the new semantic classes are missing.

- [ ] **Step 3: Replace the stylesheet**

Use these tokens and constraints:

```css
:root {
  color: #111827;
  background: #f3f4f6;
  font-family: system-ui, -apple-system, "Noto Sans KR", sans-serif;
  --surface: #ffffff;
  --border: #111827;
  --muted: #4b5563;
  --primary: #075985;
  --success: #166534;
  --danger: #991b1b;
}

.app-shell { width: min(100%, 520px); min-height: 100dvh; margin: 0 auto; }
.body-text { font-size: 1.375rem; line-height: 1.5; }
.amount-display { font-size: clamp(3rem, 14vw, 5rem); font-weight: 900; }
.primary-action { min-height: 76px; font-size: 1.5rem; }
.keypad button { min-height: 72px; font-size: 2rem; }
.bank-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
```

Retain safe-area padding, visible focus states, disabled states with text and contrast, reduced-motion handling, and a maximum content width so tablets keep the same single-column layout.

- [ ] **Step 4: Run view tests and build**

Run: `npm.cmd run test:run -- tests/seller-view.test.ts tests/pay-view.test.ts`

Expected: tests pass.

Run: `npm.cmd run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 5: Commit**

```powershell
git add src/styles.css src/seller/main.ts src/pay/main.ts tests/seller-view.test.ts tests/pay-view.test.ts
git commit -m "feat: apply high-contrast mobile interface"
```

### Task 7: Make the site installable as a PWA

**Files:**
- Create: `src/pwa.ts`
- Create: `tests/pwa.test.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/qr-pay-192.png`
- Create: `public/icons/qr-pay-512.png`
- Modify: `index.html`
- Modify: `pay/index.html`
- Modify: `src/seller/main.ts`
- Modify: `src/pay/main.ts`

- [ ] **Step 1: Write the failing registration test**

```ts
it('registers the service worker below the current base path', async () => {
  const register = vi.fn(async () => ({}));
  await registerPwa({ serviceWorker: { register } } as unknown as Navigator, 'https://example.com/QR-pay/');
  expect(register).toHaveBeenCalledWith('https://example.com/QR-pay/sw.js', { scope: 'https://example.com/QR-pay/' });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `npm.cmd run test:run -- tests/pwa.test.ts`

Expected: `registerPwa` does not exist.

- [ ] **Step 3: Implement registration and app-shell cache**

`registerPwa` must no-op when service workers are unsupported, build the worker URL from `document.baseURI`, and catch registration errors without blocking the payment UI. `public/sw.js` must cache the scoped root, `pay/`, the manifest, and icons on install; delete old `qr-pay-*` caches on activate; and use network-first for navigations with cached fallback.

- [ ] **Step 4: Add manifest and icons**

Manifest values:

```json
{
  "name": "행사 QR 송금",
  "short_name": "QR 송금",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f3f4f6",
  "theme_color": "#075985"
}
```

Add 192×192 and 512×512 PNG icons with a dark-blue background, white QR corners, and the Korean label `송금` kept inside the maskable safe area.

- [ ] **Step 5: Add HTML metadata and run tests/build**

Add relative manifest and icon links to both HTML entries. Import and invoke `registerPwa` from both entry modules.

Run: `npm.cmd run test:run -- tests/pwa.test.ts`

Expected: registration test passes.

Run: `npm.cmd run build`

Expected: manifest, worker, and both icon files exist under `dist/`.

- [ ] **Step 6: Commit**

```powershell
git add src/pwa.ts tests/pwa.test.ts public/manifest.webmanifest public/sw.js public/icons index.html pay/index.html src/seller/main.ts src/pay/main.ts
git commit -m "feat: make QR Pay installable"
```

### Task 8: Write beginner-first setup and operating instructions

**Files:**
- Create: `docs/처음-실행하기.md`
- Modify: `README.md`
- Modify: `tests/run-dev-script.test.ts`

- [ ] **Step 1: Add a launcher-contract test**

Assert `run-dev.cmd` changes to `%~dp0`, prints the exact local URL, installs dependencies only when missing, and never requires the user to type a trailing backslash command.

- [ ] **Step 2: Run and confirm the launcher test**

Run: `npm.cmd run test:run -- tests/run-dev-script.test.ts`

Expected: pass if the launcher contract remains intact; otherwise fix only the violated contract.

- [ ] **Step 3: Write the nontechnical guide**

The guide must contain these exact sections:

1. `처음 한 번 준비하기`
2. `실제 계좌정보 입력하기`
3. `PC에서 시험 실행하기`
4. `GitHub Pages에 배포하기`
5. `삼성 휴대폰에 앱으로 설치하기`
6. `행사장에서 사용하는 순서`
7. `행사 전 1,000원 시험 송금`
8. `문제가 생겼을 때`

Include copy-paste PowerShell commands with the absolute project path and explicitly explain that commands must be run in `C:\QR-pay service`. Explain that `.env.local` is local-only and GitHub Actions variables/secrets must be configured separately.

- [ ] **Step 4: Update README and verify links**

Make README lead with a link to `docs/처음-실행하기.md`, then retain concise developer commands, environment keys, deployment notes, and test commands.

- [ ] **Step 5: Commit**

```powershell
git add README.md docs/처음-실행하기.md tests/run-dev-script.test.ts run-dev.cmd
git commit -m "docs: add beginner QR Pay setup guide"
```

### Task 9: Full verification and deployment handoff

**Files:**
- Modify only if verification reveals an in-scope defect.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm.cmd run test:run`

Expected: every test file passes with zero failed tests.

- [ ] **Step 2: Build production output with safe test configuration**

Run `npm.cmd run build` with non-secret test environment values supplied for both sellers.

Expected: `dist/index.html`, `dist/pay/index.html`, `dist/manifest.webmanifest`, `dist/sw.js`, and both icons exist.

- [ ] **Step 3: Inspect generated URLs and secrets boundary**

Confirm QR URLs contain only seller id and amount. Confirm `.env.local` is ignored and absent from `git ls-files`. Confirm no real account number appears in tracked files.

- [ ] **Step 4: Run a local smoke test**

Start `run-dev.cmd`, open the seller page, select each seller, enter `14000` with the keypad, generate QR, confirm the customer page shows the right seller and amount, select NH and Toss, and confirm the fallback copy status remains visible.

- [ ] **Step 5: Push and inspect GitHub Actions**

Push `main`, then verify the latest `Test and deploy QR Pay` workflow. If it fails only because real GitHub variables/secrets are intentionally not yet entered, report that exact external configuration requirement without exposing account data.

- [ ] **Step 6: Complete only after real-device checks**

On both Samsung phones, install from Chrome or Samsung Internet, launch from the home-screen icon, generate a 1,000-won QR, scan it on another phone, test at least one general bank and Toss, and verify each seller receives only their own bank notification.

