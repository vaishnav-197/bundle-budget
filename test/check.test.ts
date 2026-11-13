import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allPassed, runCheck } from '../src/check.js';
import { loadConfig, parseConfig } from '../src/config.js';
import { fixturePath } from './helpers.js';

describe('runCheck', () => {
  it('passes the webpack sample against a generous config', () => {
    const report = runCheck(
      fixturePath('webpack-app', 'stats.json'),
      fixturePath('webpack-app', 'dist'),
      loadConfig(fixturePath('configs', 'webpack-pass.json')),
    );
    expect(report.bundler).toBe('webpack');
    expect(report.assets).toHaveLength(8);
    expect(report.results.map((r) => [r.target, r.size])).toEqual([
      ['js/main.d30a747b.js', 2409],
      ['vendor', 74577],
      ['css/main.e5ec08f4.css', 180],
      ['css/settings.4da09bda.css', 124],
      ['6 JS/CSS files', 72815],
    ]);
    expect(allPassed(report)).toBe(true);
  });

  it('fails the vite sample when the entry chunk is over budget', () => {
    const report = runCheck(
      fixturePath('vite-app', 'stats.json'),
      fixturePath('vite-app', 'dist'),
      loadConfig(fixturePath('configs', 'vite-fail.json')),
    );
    expect(report.bundler).toBe('vite');
    expect(report.results.filter((r) => !r.passed).map((r) => r.target)).toEqual(['index']);
    expect(allPassed(report)).toBe(false);
  });

  it('ignores the stats file when it is inside the build directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    copyFileSync(fixturePath('edge', 'empty-webpack.json'), join(dir, 'stats.json'));
    const report = runCheck(join(dir, 'stats.json'), dir, parseConfig({ total: { max: '1 KB' } }));
    expect(report.assets).toEqual([]);
    expect(allPassed(report)).toBe(true);
  });

  it('checks an empty build', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    const report = runCheck(fixturePath('edge', 'empty-webpack.json'), dir, parseConfig({ total: { max: '1 KB' } }));
    expect(report.results).toMatchObject([{ kind: 'total', size: 0, passed: true }]);
  });

  it('rejects stats that list files missing from the build directory', () => {
    expect(() =>
      runCheck(
        fixturePath('edge', 'missing-asset', 'stats.json'),
        fixturePath('edge', 'missing-asset', 'dist'),
        parseConfig({ total: { max: '1 MB' } }),
      ),
    ).toThrow(/a file listed in the stats is missing from ".*dist": js\/lazy\.js\. Were the stats generated from this build\?/);
  });

  it('rejects a missing build directory', () => {
    expect(() =>
      runCheck(fixturePath('vite-app', 'stats.json'), 'no-such-dir', parseConfig({ total: { max: '1 MB' } })),
    ).toThrow('build directory "no-such-dir" does not exist or is not a directory');
  });

  it('rejects stats that are not valid JSON', () => {
    expect(() =>
      runCheck(fixturePath('edge', 'malformed.json'), fixturePath('vite-app', 'dist'), parseConfig({ total: { max: 1 } })),
    ).toThrow(/stats file ".*malformed\.json" is not valid JSON/);
  });

  it('rejects stats in an unknown format', () => {
    expect(() =>
      runCheck(fixturePath('edge', 'unknown-format.json'), fixturePath('vite-app', 'dist'), parseConfig({ total: { max: 1 } })),
    ).toThrow(/^unrecognised stats format/);
  });
});
