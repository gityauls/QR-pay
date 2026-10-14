import { describe, expect, it, vi } from 'vitest';
import { registerPwa } from '../src/pwa';

describe('PWA registration', () => {
  it('registers the service worker below the current base path', async () => {
    const register = vi.fn(async () => ({}));
    const navigatorLike = {
      serviceWorker: { register },
    } as unknown as Navigator;

    await registerPwa(navigatorLike, 'https://example.com/QR-pay/');

    expect(register).toHaveBeenCalledWith('https://example.com/QR-pay/sw.js', {
      scope: 'https://example.com/QR-pay/',
    });
  });

  it('does nothing when service workers are unavailable', async () => {
    await expect(registerPwa({} as Navigator, 'https://example.com/')).resolves.toBeUndefined();
  });

  it('does not block the app when registration fails', async () => {
    const navigatorLike = {
      serviceWorker: { register: vi.fn(async () => Promise.reject(new Error('offline'))) },
    } as unknown as Navigator;

    await expect(registerPwa(navigatorLike, 'https://example.com/')).resolves.toBeUndefined();
  });
});
