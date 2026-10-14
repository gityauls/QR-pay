import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('scripts/validate-deploy-env.mjs');
const firstSeller = {
  VITE_SHOP_NAME: '행사 판매점',
  VITE_USER1_LABEL: '사용자 1',
  VITE_USER1_COLOR: '#155E75',
  VITE_USER1_BANK: 'NH농협',
  VITE_USER1_HOLDER: '홍길동',
  VITE_USER1_ACCOUNT: '123-456-7890',
};

function validate(extra: Record<string, string> = {}) {
  const cleanEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')),
  );
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...cleanEnvironment, ...firstSeller, ...extra },
  });
}

describe('deployment environment validation', () => {
  it('accepts a deployment with only the first seller configured', () => {
    const result = validate();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Deployment configuration is valid.');
  });

  it('ignores second-seller labels until its account is registered', () => {
    const result = validate({ VITE_USER2_LABEL: '사용자 2' });

    expect(result.status).toBe(0);
  });

  it('rejects a partially configured second seller once its account is registered', () => {
    const result = validate({ VITE_USER2_ACCOUNT: '987-654-3210' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Second seller is partially configured');
  });

  it('accepts two complete sellers', () => {
    const result = validate({
      VITE_USER2_LABEL: '사용자 2',
      VITE_USER2_COLOR: '#9A3412',
      VITE_USER2_BANK: 'KB국민',
      VITE_USER2_HOLDER: '김영희',
      VITE_USER2_ACCOUNT: '987-654-3210',
    });

    expect(result.status).toBe(0);
  });
});
