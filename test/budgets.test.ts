import { describe, expect, it } from 'vitest';
import { applyBudgets } from '../src/budgets.js';
import { parseConfig } from '../src/config.js';
import type { BuildStats, MeasuredAsset } from '../src/model.js';

const asset = (file: string, raw: number): MeasuredAsset => ({ file, raw, gzip: Math.round(raw / 3), brotli: Math.round(raw / 4) });

const assets: MeasuredAsset[] = [
  asset('index.html', 600),
  asset('assets/index-AAAAAAAA.js', 90_000),
  asset('assets/index-BBBBBBBB.css', 3_000),
  asset('assets/lazy-CCCCCCCC.js', 12_000),
  asset('assets/logo-DDDDDDDD.svg', 6_000),
];

const stats: BuildStats = {
  bundler: 'vite',
  files: ['assets/index-AAAAAAAA.js', 'assets/lazy-CCCCCCCC.js'],
  chunks: [
    { name: 'index', files: ['assets/index-AAAAAAAA.js', 'assets/index-BBBBBBBB.css'], entry: true, modules: [] },
    { name: 'lazy', files: ['assets/lazy-CCCCCCCC.js'], entry: false, modules: [] },
  ],
};

const run = (config: unknown) => applyBudgets(parseConfig(config), stats, assets);

describe('applyBudgets', () => {
  it('checks each asset that matches a pattern', () => {
    const results = run({ budgets: [{ asset: 'assets/*.js', max: '20 KB', compression: 'gzip' }] });
    expect(results).toEqual([
      { kind: 'asset', budget: 'asset assets/*.js', target: 'assets/index-AAAAAAAA.js', compression: 'gzip', size: 30_000, max: 20_000, passed: false },
      { kind: 'asset', budget: 'asset assets/*.js', target: 'assets/lazy-CCCCCCCC.js', compression: 'gzip', size: 4_000, max: 20_000, passed: true },
    ]);
  });

  it('uses the compression of each budget', () => {
    const results = run({
      compression: 'brotli',
      budgets: [
        { asset: 'assets/lazy-*.js', max: 100_000 },
        { asset: 'assets/lazy-*.js', max: 100_000, compression: 'raw' },
      ],
    });
    expect(results.map((r) => [r.compression, r.size])).toEqual([
      ['brotli', 3_000],
      ['raw', 12_000],
    ]);
  });

  it('passes when the size equals the limit', () => {
    const [result] = run({ budgets: [{ asset: 'index.html', max: 600, compression: 'raw' }] });
    expect(result?.passed).toBe(true);
  });

  it('measures a chunk by its JavaScript files only', () => {
    const [index] = run({ budgets: [{ chunk: 'index', max: '100 KB', compression: 'raw' }] });
    expect(index).toMatchObject({ kind: 'chunk', budget: 'chunk index', target: 'index', size: 90_000, passed: true });
  });

  it('matches chunk names with patterns', () => {
    const results = run({ budgets: [{ chunk: '*', max: '10 KB' }] });
    expect(results.map((r) => [r.target, r.passed])).toEqual([
      ['index', false],
      ['lazy', true],
    ]);
  });

  it('adds up all JavaScript and CSS files for the total', () => {
    const [total] = run({ total: { max: '110 KB', compression: 'raw' } });
    expect(total).toEqual({
      kind: 'total',
      budget: 'total',
      target: '3 JS/CSS files',
      compression: 'raw',
      size: 105_000,
      max: 110_000,
      passed: true,
    });
  });

  it('puts the total after the other budgets', () => {
    const results = run({ total: { max: '1 MB' }, budgets: [{ chunk: 'lazy', max: '1 MB' }] });
    expect(results.map((r) => r.kind)).toEqual(['chunk', 'total']);
  });

  it('rejects an asset pattern that matches nothing', () => {
    expect(() => run({ budgets: [{ asset: 'js/*.js', max: '1 KB' }] })).toThrow(
      'budgets[0]: asset pattern "js/*.js" matched no files in the build',
    );
  });

  it('rejects a chunk pattern that matches nothing', () => {
    expect(() => run({ budgets: [{ asset: '*.html', max: '1 KB' }, { chunk: 'vendor', max: '1 KB' }] })).toThrow(
      'budgets[1]: chunk pattern "vendor" matched no chunks in the stats',
    );
  });

  it('rejects a chunk file that was not measured', () => {
    const broken: BuildStats = { ...stats, chunks: [{ name: 'gone', files: ['gone.js'], entry: false, modules: [] }] };
    expect(() => applyBudgets(parseConfig({ budgets: [{ chunk: 'gone', max: 1 }] }), broken, assets)).toThrow(
      'chunk "gone" lists "gone.js", which is not in the build directory',
    );
  });

  it('passes an empty build against a total budget', () => {
    const empty: BuildStats = { bundler: 'webpack', files: [], chunks: [] };
    const [total] = applyBudgets(parseConfig({ total: { max: '1 KB' } }), empty, []);
    expect(total).toMatchObject({ size: 0, target: '0 JS/CSS files', passed: true });
  });
});
