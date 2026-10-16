import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('generic deployment', () => {
  it('validates with no shop or account environment values', () => {
    const script = resolve('scripts/validate-deploy-env.mjs');
    const cleanEnvironment = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')),
    );
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: cleanEnvironment });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Generic local setup deployment is valid.');
  });

  it('gives KakaoTalk an absolute preview image from the Pages URL', () => {
    const html = readFileSync(resolve('index.html'), 'utf8');
    const workflow = readFileSync(resolve('.github', 'workflows', 'pages.yml'), 'utf8');
    expect(html).toContain('<meta property="og:image" content="%VITE_SITE_URL%icons/qr-pay-share.png" />');
    expect(workflow).toContain('VITE_SITE_URL: ${{ steps.pages.outputs.base_url }}/');
  });

  it('does not inject repository account variables or secrets into Pages', () => {
    const workflow = readFileSync(resolve('.github', 'workflows', 'pages.yml'), 'utf8');
    expect(workflow).not.toContain('QR_PAY_');
    expect(workflow).not.toContain('VITE_USER');
    expect(workflow).not.toContain('Validate account configuration');
  });
});
