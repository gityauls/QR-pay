export type Platform = 'ios' | 'other';

type NavigatorLike = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

export function detectPlatform(navigatorLike: NavigatorLike): Platform {
  if (/iPhone|iPad|iPod/.test(navigatorLike.userAgent)) return 'ios';
  // iPadOS Safari reports itself as a Mac; touch support tells them apart.
  if (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1) return 'ios';
  return 'other';
}
