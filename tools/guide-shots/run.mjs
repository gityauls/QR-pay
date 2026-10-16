// Rebuilds the guide pictures in public/guide from the real app.
// Usage (from the repo root): npm --prefix tools/guide-shots install, then node tools/guide-shots/run.mjs
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { build, preview } from 'vite';

const ROOT = resolve(import.meta.dirname, '..', '..');
const GUIDE = resolve(ROOT, 'public', 'guide');
const IMG = resolve(GUIDE, 'img');
const CARDS = resolve(GUIDE, 'cards');
const BASE = '/QR-pay/';
const PORT = 4173;
const APP = `http://localhost:${PORT}${BASE}`;
const fileUrl = (...parts) => pathToFileURL(resolve(...parts)).href;

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 KAKAOTALK/25.8.0 (INAPP)',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0',
};

// Pretend the page was opened from the home screen icon, with a recognizer that hears "만오천원".
const STANDALONE = `
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => query.includes('display-mode: standalone')
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : original(query);
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: '만오천원' }]] }); this.onend?.(); }, 50); }
  };
`;

const CARD_SETS = [
  ['android-1', '갤럭시 설치 방법', '1/2', [
    [1, '카카오톡에서 링크 누르기', 'chat'],
    [2, '크롬이 저절로 열려요', 'kakao-android'],
    [3, '“휴대폰에 설치하기” 누르기', 'install-android'],
    [4, '창이 뜨면 “설치” 누르기', 'install-dialog'],
  ]],
  ['android-2', '갤럭시 설치 방법', '2/2', [
    [5, '홈 화면의 “QR 송금” 누르기', 'home'],
    [6, '처음 한 번 정보 넣기', 'setup'],
    [7, '금액 누르고 “QR 만들기”', 'amount'],
    [8, '손님에게 QR 보여 주기', 'qr'],
  ]],
  ['iphone-1', '아이폰 설치 방법', '1/2', [
    [1, '카카오톡에서 링크 누르기', 'chat'],
    [2, 'Safari가 저절로 열려요', 'kakao-ios'],
    [3, '아래쪽 공유 버튼 누르기', 'ios-bar'],
    [4, '“홈 화면에 추가” 누르기', 'ios-sheet'],
  ]],
  ['iphone-2', '아이폰 설치 방법', '2/2', [
    [5, '오른쪽 위 “추가” 누르기', 'ios-add'],
    [6, '홈 화면의 “QR 송금” 누르기', 'home'],
    [7, '아이콘으로 연 뒤 정보 넣기', 'setup'],
    [8, '금액 누르고 “QR 만들기”', 'amount'],
  ]],
  // Features are not a sequence, so their badges carry a short name instead of a number.
  ['features', '편리한 기능', '', [
    ['말', '“말로 입력” 누르고 “만오천원”', 'voice'],
    ['QR', '“QR 코드 다시 보기”로 15초 더', 'qr'],
    ['100', '설정에서 100원 단위 켜기', 'settings-step'],
    ['공유', '설정에서 다른 분께 앱 보내기', 'settings-share'],
  ]],
];

const CARD_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { word-break: keep-all; width: 540px; height: 1200px; display: flex; flex-direction: column; background: #f3f4f6; color: #111827; font-family: "Malgun Gothic", system-ui, sans-serif; }
  header { display: flex; align-items: center; gap: 12px; height: 72px; padding: 0 18px; background: #075985; color: #fff; }
  header img { width: 44px; height: 44px; border-radius: 10px; border: 2px solid rgba(255,255,255,.4); }
  header b { flex: 1; font-size: 27px; font-weight: 900; letter-spacing: -0.02em; }
  header span { font-size: 22px; font-weight: 800; opacity: .9; }
  .grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 10px; padding: 10px; }
  .cell { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 8px 8px; border-radius: 16px; background: #fff; border: 1px solid #d1d5db; min-height: 0; }
  .cell h2 { display: flex; align-items: flex-start; gap: 8px; width: 100%; min-height: 56px; margin: 0; font-size: 20px; font-weight: 900; line-height: 1.35; letter-spacing: -0.03em; }
  .cell h2 i { flex: none; display: grid; place-items: center; min-width: 30px; height: 30px; padding: 0 6px; border-radius: 15px; background: #075985; color: #fff; font-style: normal; font-size: 16px; }
  .cell img { flex: 1; min-height: 0; max-width: 100%; object-fit: contain; border: 5px solid #1f2937; border-radius: 18px; background: #1f2937; }
`;

async function phone(browser, userAgent, { standalone = false, width = 384, height = 800 } = {}) {
  const context = await browser.newContext({
    userAgent, viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'ko-KR',
  });
  if (standalone) await context.addInitScript(STANDALONE);
  return context;
}

// The KakaoTalk hand-off starts a navigation that never commits, so only wait for the response.
async function open(page) {
  await page.goto(APP, { waitUntil: 'commit' });
  await page.locator('.panel').first().waitFor();
}

async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(IMG, `${name}.jpg`), type: 'jpeg', quality: 82 });
  console.log('saved', name);
}

async function appScreens(browser) {
  for (const [ua, name, options] of [
    [UA.kakaoAndroid, 'kakao-android', {}],
    [UA.android, 'install-android', {}],
    [UA.kakaoIos, 'kakao-ios', { width: 390 }],
    [UA.ios, 'install-ios', { width: 390 }],
  ]) {
    const context = await phone(browser, ua, options);
    const page = await context.newPage();
    await open(page);
    await shot(page, name);
    await context.close();
  }

  {
    const context = await phone(browser, UA.samsung);
    const page = await context.newPage();
    await open(page);
    await page.getByRole('button', { name: '휴대폰에 설치하기' }).click();
    await page.getByText('현재 페이지 추가').waitFor();
    await shot(page, 'install-samsung-menu');
    await context.close();
  }

  const context = await phone(browser, UA.android, { standalone: true });
  const page = await context.newPage();
  await open(page);
  await page.locator('[name=shopName]').fill('행복 농산물');
  await page.locator('[name=label]').fill('홍길동');
  await page.locator('[name=bank]').selectOption('NH농협은행');
  await page.locator('[name=holder]').fill('홍길동');
  await page.locator('[name=accountDisplay]').fill('123-4567-8901-23');
  await shot(page, 'setup');
  await page.getByRole('button', { name: '저장하고 시작하기' }).click();
  await page.getByText('받을 금액').waitFor();
  await page.locator('[data-quick-amount="10000"]').click();
  await page.locator('[data-quick-amount="5000"]').click();
  await shot(page, 'amount');
  await page.getByRole('button', { name: 'QR 만들기' }).click();
  await page.locator('.qr-image').waitFor();
  await shot(page, 'qr');
  await open(page);
  await page.getByRole('button', { name: '말로 입력' }).click();
  await page.getByText('“만오천원” →').waitFor();
  await shot(page, 'voice');
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByRole('button', { name: '다른 분께 앱 보내기' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 160));
  await shot(page, 'settings-share');
  await page.getByRole('switch').click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shot(page, 'settings-step');
  await context.close();
}

// Screens outside the app (chat, browser dialogs, home screen) are drawn in mocks.html.
async function drawnScreens(browser) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(fileUrl(import.meta.dirname, 'mocks.html'));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    for (const mark of document.querySelectorAll('[data-for]')) {
      const frame = mark.closest('.mock').getBoundingClientRect();
      const box = document.querySelector(mark.dataset.for).getBoundingClientRect();
      if (mark.classList.contains('finger')) {
        mark.style.left = `${box.right - frame.left - 18}px`;
        mark.style.top = `${box.bottom - frame.top - 18}px`;
        continue;
      }
      const pad = Number(mark.dataset.pad) + 5;
      mark.style.left = `${box.left - frame.left - pad}px`;
      mark.style.top = `${box.top - frame.top - pad}px`;
      mark.style.width = `${box.width + pad * 2 - 10}px`;
      mark.style.height = `${box.height + pad * 2 - 10}px`;
      mark.style.borderRadius = mark.dataset.for === '#chat-card' || mark.dataset.for === '#add-home' ? '16px' : '999px';
    }
  });
  for (const id of ['chat', 'install-dialog', 'home', 'ios-bar', 'ios-sheet', 'ios-add']) {
    await page.locator(`#${id}`).screenshot({ path: resolve(IMG, `${id}.jpg`), type: 'jpeg', quality: 82 });
    console.log('saved', id);
  }
  await context.close();
}

async function cards(browser) {
  const page = await browser.newPage({ viewport: { width: 540, height: 1200 }, deviceScaleFactor: 2 });
  for (const [name, title, part, steps] of CARD_SETS) {
    const cells = steps.map(([n, text, img]) => (
      `<div class="cell"><h2><i>${n}</i><span>${text}</span></h2><img src="${fileUrl(IMG, `${img}.jpg`)}" alt=""></div>`
    )).join('');
    // setContent runs on the guide page so file:// images are allowed to load.
    await page.goto(fileUrl(GUIDE, 'index.html'));
    await page.setContent(
      `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CARD_CSS}</style></head><body>`
      + `<header><img src="${fileUrl(ROOT, 'public', 'icons', 'qr-pay-192.png')}" alt=""><b>${title}</b>${part ? `<span>${part}</span>` : ''}</header>`
      + `<div class="grid">${cells}</div></body></html>`,
      { waitUntil: 'load' },
    );
    await page.screenshot({ path: resolve(CARDS, `${name}.jpg`), type: 'jpeg', quality: 85 });
    console.log('saved', name);
  }
  await page.close();
}

async function shareImage(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(fileUrl(import.meta.dirname, 'og.html'));
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: resolve(ROOT, 'public', 'icons', 'qr-pay-share.png') });
  console.log('saved qr-pay-share');
  await page.close();
}

rmSync(IMG, { recursive: true, force: true });
mkdirSync(IMG, { recursive: true });
mkdirSync(CARDS, { recursive: true });
process.env.VITE_SITE_URL ??= 'https://gityauls.github.io/QR-pay/';
await build({ root: ROOT, base: BASE, logLevel: 'warn' });
const server = await preview({ root: ROOT, base: BASE, preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge', headless: true });
try {
  await shareImage(browser);
  await appScreens(browser);
  await drawnScreens(browser);
  await cards(browser);
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}
