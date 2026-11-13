import { describe, expect, it } from 'vitest';
import type { CheckReport } from '../src/check.js';
import { createColors, shouldUseColor } from '../src/color.js';
import { formatJson, formatTable, packageSizes, usagePercent } from '../src/report.js';

const report: CheckReport = {
  bundler: 'webpack',
  dir: 'dist',
  assets: [
    { file: 'js/main.js', raw: 5_000, gzip: 2_000, brotli: 1_800 },
    { file: 'js/vendor.js', raw: 240_000, gzip: 75_000, brotli: 64_000 },
  ],
  chunks: [
    {
      name: 'main',
      files: ['js/main.js'],
      entry: true,
      modules: [
        { id: './src/index.js', package: null, size: 900 },
        { id: './src/App.js', package: null, size: 600 },
      ],
    },
    {
      name: 'vendor',
      files: ['js/vendor.js'],
      entry: false,
      modules: [
        { id: './node_modules/react-dom/client.js', package: 'react-dom', size: 500_000 },
        { id: './node_modules/react/index.js', package: 'react', size: 18_000 },
        { id: './node_modules/a/index.js', package: 'a', size: 10 },
        { id: './node_modules/b/index.js', package: 'b', size: 10 },
        { id: './node_modules/c/index.js', package: 'c', size: 10 },
        { id: './node_modules/d/index.js', package: 'd', size: 10 },
      ],
    },
  ],
  results: [
    { kind: 'asset', budget: 'asset js/main.js', target: 'js/main.js', compression: 'gzip', size: 2_000, max: 10_000, passed: true },
    { kind: 'chunk', budget: 'chunk vendor', target: 'vendor', compression: 'gzip', size: 75_000, max: 50_000, passed: false },
    { kind: 'total', budget: 'total', target: '2 JS/CSS files', compression: 'brotli', size: 65_800, max: 100_000, passed: true },
  ],
};

const passing: CheckReport = { ...report, results: report.results.filter((r) => r.passed) };

describe('formatTable', () => {
  it('prints an aligned table with a summary', () => {
    expect(formatTable(report, { color: false, verbose: false })).toBe(
      [
        'webpack build in dist (2 files)',
        '',
        '      Budget            Target              Size      Limit  Used  Compression',
        'PASS  asset js/main.js  js/main.js       2.00 KB   10.00 KB   20%  gzip',
        'FAIL  chunk vendor      vendor          75.00 KB   50.00 KB  150%  gzip',
        'PASS  total             2 JS/CSS files  65.80 KB  100.00 KB   66%  brotli',
        '',
        '1 of 3 checks over budget.',
        '',
      ].join('\n'),
    );
  });

  it('says when everything passed', () => {
    expect(formatTable(passing, { color: false, verbose: false })).toContain('\nAll 2 checks passed.\n');
    const single = { ...report, results: report.results.slice(0, 1) };
    expect(formatTable(single, { color: false, verbose: false })).toContain('\n1 check passed.\n');
  });

  it('uses no escape codes without colour', () => {
    expect(formatTable(report, { color: false, verbose: true })).not.toContain('\u001b[');
  });

  it('colours the status column', () => {
    const output = formatTable(report, { color: true, verbose: false });
    expect(output).toContain('\u001b[32mPASS\u001b[39m');
    expect(output).toContain('\u001b[1m\u001b[31mFAIL\u001b[39m\u001b[22m');
  });

  it('lists the largest packages per chunk in verbose mode', () => {
    const output = formatTable(report, { color: false, verbose: true });
    expect(output).toContain('Chunks (module sizes before minification)');
    expect(output).toContain('  main (entry)  js/main.js\n    (app code)    1.50 KB\n');
    expect(output).toContain('  vendor  js/vendor.js\n    react-dom  500.00 KB\n    react       18.00 KB\n');
    expect(output).toContain('    ... and 1 more\n');
  });

  it('leaves out the chunk list by default', () => {
    expect(formatTable(report, { color: false, verbose: false })).not.toContain('Chunks');
  });
});

describe('formatJson', () => {
  it('prints machine-readable results', () => {
    const output = JSON.parse(formatJson(report));
    expect(output.bundler).toBe('webpack');
    expect(output.passed).toBe(false);
    expect(output.budgets).toEqual(report.results);
    expect(output.assets).toEqual(report.assets);
    expect(output.chunks[0]).toEqual({
      name: 'main',
      entry: true,
      files: ['js/main.js'],
      packages: [{ name: '(app code)', size: 1_500 }],
    });
    expect(output.chunks[1].packages).toHaveLength(6);
  });

  it('reports passed: true when every check passed', () => {
    expect(JSON.parse(formatJson(passing)).passed).toBe(true);
  });
});

describe('packageSizes', () => {
  it('groups modules by package, largest first, then by name', () => {
    expect(
      packageSizes([
        { id: 'a', package: 'x', size: 1 },
        { id: 'b', package: 'y', size: 5 },
        { id: 'c', package: 'x', size: 2 },
        { id: 'd', package: null, size: 3 },
      ]),
    ).toEqual([
      { name: 'y', size: 5 },
      { name: '(app code)', size: 3 },
      { name: 'x', size: 3 },
    ]);
  });
});

describe('usagePercent', () => {
  it('rounds to a whole percentage', () => {
    expect(usagePercent(2_000, 10_000)).toBe('20%');
    expect(usagePercent(75_052, 70_000)).toBe('107%');
  });
});

describe('shouldUseColor', () => {
  it('only uses colour on a terminal without NO_COLOR', () => {
    expect(shouldUseColor(true, {})).toBe(true);
    expect(shouldUseColor(false, {})).toBe(false);
    expect(shouldUseColor(undefined, {})).toBe(false);
    expect(shouldUseColor(true, { NO_COLOR: '1' })).toBe(false);
    expect(shouldUseColor(true, { NO_COLOR: '' })).toBe(true);
  });
});

describe('createColors', () => {
  it('returns text unchanged when disabled', () => {
    const colors = createColors(false);
    expect(colors.red('x') + colors.green('y') + colors.bold('z') + colors.dim('w')).toBe('xyzw');
  });
});
