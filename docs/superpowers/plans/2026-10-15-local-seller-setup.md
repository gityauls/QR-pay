# Local Seller Setup and Compact Amount Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic installable QR Pay app with locally managed recipients and a compact one-screen keypad.

**Architecture:** Store a validated versioned configuration in `localStorage`. Put each validated payment payload in the URL fragment so the static customer page can read local recipient data without a backend.

**Tech Stack:** TypeScript, Vite, Vitest/jsdom, QRCode, CSS/PWA.

---

### Task 1: Local configuration

**Files:** Create `src/lib/local-config.ts`; modify `src/config.ts`, `src/lib/storage.ts`; test `tests/local-config.test.ts`, `tests/storage.test.ts`.

- [ ] Write failing tests for arbitrary IDs, validation, duplicates, automatic colors, corrupt storage, CRUD, and final-recipient protection.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the minimal validated local configuration model and persistence.
- [ ] Re-run focused tests.

### Task 2: Fragment payment payload

**Files:** Modify `src/lib/pay-url.ts`, `src/pay/main.ts`; test `tests/pay-url.test.ts`, `tests/pay-view.test.ts`.

- [ ] Write failing tests for UTF-8-safe fragment round trips, malformed data rejection, and account absence before `#`.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement strict encoding/decoding and update the customer page while preserving Toss/bank behavior.
- [ ] Re-run focused tests.

### Task 3: Setup and recipient management

**Files:** Modify `src/seller/main.ts`, `src/lib/banks.ts`, `src/styles.css`; test `tests/seller-view.test.ts`, `tests/banks.test.ts`.

- [ ] Write failing UI tests for first-run setup, bank selection/custom bank, shop rename, add/edit/delete, and automatic colors.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement accessible forms and persistent management actions.
- [ ] Re-run focused tests.

### Task 4: Compact B layout and installation help

**Files:** Modify `src/styles.css`, `src/seller/main.ts`, `src/pwa.ts`; test `tests/seller-view.test.ts`, `tests/pwa.test.ts`.

- [ ] Write failing tests for compact layout hooks and installation guidance.
- [ ] Run focused tests and confirm expected failures.
- [ ] Apply B proportions, 48px action height, low-height media rules, and install instructions.
- [ ] Re-run focused tests.

### Task 5: Generic deployment and verification

**Files:** Modify `.github/workflows/pages.yml`, `scripts/validate-deploy-env.mjs`, `tests/deploy-env.test.ts`, `README.md`, `docs/처음-실행하기.md`, `public/sw.js`.

- [ ] Write failing tests proving no account environment values are required.
- [ ] Remove account injection and update documentation/cache.
- [ ] Run `npm.cmd test -- --run` and `npm.cmd run build`.
- [ ] Capture 360×640 and 390×844 screens, scan staged data, commit, push, and verify Pages.
