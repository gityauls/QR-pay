export type InAppBrowser = 'kakao' | 'webview' | null;
export type BrowserKind = 'samsung' | 'other';
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export type InstallController = {
  canPrompt(): boolean;
  installed(): boolean;
  prompt(): Promise<InstallOutcome>;
  onChange(listener: () => void): () => void;
};

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type DisplayWindow = {
  matchMedia?: (query: string) => { matches: boolean };
  navigator: { standalone?: boolean };
};

// In-app browsers keep their own storage and cannot install a home-screen app.
export function detectInAppBrowser(userAgent: string): InAppBrowser {
  if (/KAKAOTALK/i.test(userAgent)) return 'kakao';
  if (/; wv\)|NAVER\(inapp|\bLine\/|Instagram|FBAN|FBAV|BAND\/|DaumApps/i.test(userAgent)) return 'webview';
  return null;
}

export function detectBrowser(userAgent: string): BrowserKind {
  return /SamsungBrowser/i.test(userAgent) ? 'samsung' : 'other';
}

export function kakaoExternalUrl(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}

export function chromeIntentUrl(url: string): string {
  return `intent://${url.replace(/^https:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function isStandaloneDisplay(windowLike: DisplayWindow): boolean {
  if (windowLike.navigator.standalone === true) return true;
  try {
    return windowLike.matchMedia?.('(display-mode: standalone)').matches ?? false;
  } catch {
    return false;
  }
}

export function createInstallController(target: EventTarget): InstallController {
  let deferred: InstallPromptEvent | null = null;
  let wasInstalled = false;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };

  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  target.addEventListener('appinstalled', () => {
    wasInstalled = true;
    deferred = null;
    notify();
  });

  return {
    canPrompt: () => deferred !== null,
    installed: () => wasInstalled,
    async prompt() {
      const event = deferred;
      if (!event) return 'unavailable';
      deferred = null;
      try {
        await event.prompt();
        const choice = await event.userChoice;
        return choice.outcome;
      } catch {
        return 'unavailable';
      } finally {
        notify();
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
