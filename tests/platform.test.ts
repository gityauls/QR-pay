import { describe, expect, it } from 'vitest';
import { detectPlatform, type Platform } from '../src/lib/platform';

describe('detectPlatform', () => {
  it.each<[string, string, number, Platform]>([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1', 'iPhone', 5, 'ios'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0 Mobile Safari/604.1', 'iPhone', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 'MacIntel', 5, 'ios'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S921N) Chrome/130.0 Mobile Safari/537.36', 'Linux armv8l', 5, 'other'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 'MacIntel', 0, 'other'],
  ])('%s -> %s', (userAgent, platform, maxTouchPoints, expected) => {
    expect(detectPlatform({ userAgent, platform, maxTouchPoints })).toBe(expected);
  });
});
