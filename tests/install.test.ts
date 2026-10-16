import { describe, expect, it, vi } from 'vitest';
import {
  chromeIntentUrl, createInstallController, detectBrowser, detectInAppBrowser, isStandaloneDisplay, kakaoExternalUrl,
} from '../src/lib/install';

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
const KAKAO_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 KAKAOTALK/25.8.0 (INAPP)';
const KAKAO_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0';
const NAVER_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.0.0)';
const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

type FakePromptEvent = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function promptEvent(outcome: 'accepted' | 'dismissed'): FakePromptEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as FakePromptEvent;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('in-app browser detection', () => {
  it.each([
    [KAKAO_ANDROID, 'kakao'],
    [KAKAO_IOS, 'kakao'],
    [NAVER_ANDROID, 'webview'],
    [ANDROID_CHROME, null],
    [SAMSUNG, null],
    [IOS_SAFARI, null],
  ])('classifies %s', (userAgent, expected) => {
    expect(detectInAppBrowser(userAgent)).toBe(expected);
  });

  it('tells Samsung Internet apart from other browsers', () => {
    expect(detectBrowser(SAMSUNG)).toBe('samsung');
    expect(detectBrowser(ANDROID_CHROME)).toBe('other');
  });
});

describe('escape links', () => {
  it('asks KakaoTalk to open the page in the phone browser', () => {
    expect(kakaoExternalUrl('https://gityauls.github.io/QR-pay/'))
      .toBe('kakaotalk://web/openExternal?url=https%3A%2F%2Fgityauls.github.io%2FQR-pay%2F');
  });

  it('builds a Chrome intent for other Android in-app browsers', () => {
    expect(chromeIntentUrl('https://gityauls.github.io/QR-pay/?from=band'))
      .toBe('intent://gityauls.github.io/QR-pay/?from=band#Intent;scheme=https;package=com.android.chrome;end');
  });
});

describe('standalone detection', () => {
  it('detects an app opened from the home screen', () => {
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe(true);
    expect(isStandaloneDisplay({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(true);
  });

  it('treats a missing matchMedia as a normal browser tab', () => {
    expect(isStandaloneDisplay({ navigator: {} })).toBe(false);
  });
});

describe('install controller', () => {
  it('is unavailable until the browser offers installation', async () => {
    const controller = createInstallController(new EventTarget());
    expect(controller.canPrompt()).toBe(false);
    await expect(controller.prompt()).resolves.toBe('unavailable');
  });

  it('keeps the browser prompt and shows it on request', async () => {
    const target = new EventTarget();
    const controller = createInstallController(target);
    const listener = vi.fn();
    controller.onChange(listener);
    const event = promptEvent('accepted');
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(controller.canPrompt()).toBe(true);
    expect(listener).toHaveBeenCalled();
    await expect(controller.prompt()).resolves.toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(controller.canPrompt()).toBe(false);
  });

  it('reports a dismissed prompt', async () => {
    const target = new EventTarget();
    const controller = createInstallController(target);
    target.dispatchEvent(promptEvent('dismissed'));
    await expect(controller.prompt()).resolves.toBe('dismissed');
  });

  it('remembers that the app was installed', () => {
    const target = new EventTarget();
    const controller = createInstallController(target);
    target.dispatchEvent(new Event('appinstalled'));
    expect(controller.installed()).toBe(true);
  });
});
