import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Windows local launcher', () => {
  it.runIf(process.platform === 'win32')(
    'finds package.json even when launched outside the project folder',
    () => {
      const launcher = resolve(import.meta.dirname, '..', 'run-dev.cmd');
      const result = spawnSync('cmd.exe', [
        '/d',
        '/s',
        '/c',
        `""${launcher}" --check"`,
      ], {
        cwd: process.env.USERPROFILE,
        encoding: 'utf8',
        windowsVerbatimArguments: true,
      });

      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain('Project directory OK');
    },
  );
});
