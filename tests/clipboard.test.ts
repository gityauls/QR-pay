import { describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/lib/clipboard';

describe('copyText', () => {
  it('copies through the modern Clipboard API', async () => {
    const writeText = vi.fn(async () => undefined);
    expect(await copyText('1234567890', { writeText }, document)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('1234567890');
  });

  it('returns false when clipboard and fallback copy are unavailable', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('blocked');
    });
    expect(await copyText('1234567890', { writeText }, document)).toBe(false);
  });
});
