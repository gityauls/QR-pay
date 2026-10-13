# Minimal QR Pay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Pages-ready mobile web app that lets one of two sellers enter an amount, show a QR, and save confirmed sales locally while customers see and copy the correct account.

**Architecture:** A Vite multi-page TypeScript app serves a seller page and a customer payment page from one static deployment. Pure functions own validation, URL construction, configuration parsing, and local sales records; thin DOM controllers render the two interfaces.

**Tech Stack:** Vite, TypeScript, Vitest, jsdom, qrcode, GitHub Actions/Pages

---

## File map

- `index.html`: seller entry page.
- `pay/index.html`: customer payment page with `noindex` metadata.
- `src/config.ts`: build-time seller/account configuration parsing and validation.
- `src/lib/money.ts`: amount parsing and Korean won formatting.
- `src/lib/pay-url.ts`: safe QR destination construction and query parsing.
- `src/lib/storage.ts`: current seller and per-device sales persistence.
- `src/lib/clipboard.ts`: clipboard API with a safe legacy fallback.
- `src/seller/main.ts`: seller screen state and events.
- `src/pay/main.ts`: customer payment screen state and events.
- `src/styles.css`: shared accessible mobile styles.
- `tests/*.test.ts`: unit and DOM behavior tests.
- `.github/workflows/pages.yml`: verified GitHub Pages deployment.

### Task 1: Project foundation and amount rules

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`
- Create: `tests/money.test.ts`
- Create: `src/lib/money.ts`

- [ ] Write tests asserting `parseAmount('100') === 100`, comma input is normalized, and values outside 100–500,000 or non-integers are rejected.
- [ ] Install dependencies with `npm.cmd install` and run `npm.cmd test -- tests/money.test.ts`; expect failure because `src/lib/money.ts` does not exist.
- [ ] Implement `parseAmount`, `formatWon`, and `formatWonWords` without floating-point or locale ambiguity.
- [ ] Re-run the focused test and expect all cases to pass.

### Task 2: Configuration and QR URL safety

**Files:**
- Create: `tests/config.test.ts`, `tests/pay-url.test.ts`
- Create: `src/config.ts`, `src/lib/pay-url.ts`

- [ ] Test that exactly two valid users are parsed, account copy values contain digits only, and missing configuration returns a user-facing configuration error.
- [ ] Test that `buildPayUrl(base, '2', 45000)` produces `/pay/?u=2&a=45000`, rejects bad amounts, and never includes bank, holder, or account data.
- [ ] Run the focused tests and confirm they fail because the modules are absent.
- [ ] Implement `loadAppConfig`, `getSeller`, `buildPayUrl`, and `parsePaymentRequest` with whitelist validation.
- [ ] Re-run the focused tests and expect them to pass.

### Task 3: Per-device sales records

**Files:**
- Create: `tests/storage.test.ts`
- Create: `src/lib/storage.ts`

- [ ] Test current-user persistence, malformed JSON recovery, adding a confirmed sale, and today's count/total filtering by local calendar date.
- [ ] Run the focused test and confirm it fails because the storage module is absent.
- [ ] Implement storage functions behind a small `StorageLike` interface, cap retained records, and catch quota/security errors.
- [ ] Re-run the test and expect it to pass.

### Task 4: Seller interface

**Files:**
- Create: `index.html`, `src/seller/main.ts`, `src/styles.css`
- Create: `tests/seller-view.test.ts`

- [ ] Add jsdom tests for the initial two-user choice, remembered user, invalid/empty amount disabling QR, QR destination content, and confirming a sale resetting the amount.
- [ ] Run the seller-view test and confirm it fails before the controller exists.
- [ ] Implement three simple views: user choice, amount entry, and QR display. Use DOM `textContent`, large labeled buttons, and no hidden gestures.
- [ ] Save a sale only from `입금 확인 후 다음 손님`; make `금액 다시 입력` return without recording.
- [ ] Add the normally hidden records view with today's count, total, and entries.
- [ ] Re-run the seller test and expect it to pass.

### Task 5: Customer payment interface

**Files:**
- Create: `pay/index.html`, `src/pay/main.ts`, `src/lib/clipboard.ts`
- Create: `tests/pay-view.test.ts`, `tests/clipboard.test.ts`

- [ ] Test invalid user/amount blocking, correct user account rendering, full holder display, and numeric account copy.
- [ ] Run the focused tests and confirm they fail before the modules exist.
- [ ] Implement the payment page with the amount as the largest text, one account-copy action, and plain instructions to open any bank app and enter the shown amount.
- [ ] Implement Clipboard API use plus textarea fallback and a visible manual-copy fallback.
- [ ] Re-run the focused tests and expect them to pass.

### Task 6: GitHub Pages deployment and documentation

**Files:**
- Create: `.github/workflows/pages.yml`, `public/robots.txt`, `README.md`
- Modify: `vite.config.ts`

- [ ] Configure Vite multi-page inputs and a GitHub Pages-compatible base path.
- [ ] Configure Actions to inject repository variables/secrets, run `npm ci`, `npm test`, `npm run build`, and deploy `dist` only after success.
- [ ] Document the required GitHub variables and account-number secrets, Pages enablement, two-phone installation, and real-device test checklist.
- [ ] Confirm no real account or holder value exists in tracked source.

### Task 7: Verification and mobile QA

**Files:**
- Verify all created files; change only files needed to fix observed failures.

- [ ] Run `npm.cmd test -- --run`; expect zero failed tests.
- [ ] Run `npm.cmd run build`; expect exit code 0 and both `dist/index.html` and `dist/pay/index.html`.
- [ ] Run `npm.cmd audit --omit=dev`; document any remaining production vulnerability.
- [ ] Preview the app locally, inspect seller and customer flows at a 360px-class viewport, and verify there is no horizontal overflow.
- [ ] Scan a generated QR or decode its content and verify it has only the hosted pay path, user ID, and amount.
- [ ] Review the MVP design line by line and report any unimplemented item rather than expanding scope.
