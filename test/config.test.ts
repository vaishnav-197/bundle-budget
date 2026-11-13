import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, parseConfig } from '../src/config.js';
import { InputError } from '../src/errors.js';
import { fixturePath } from './helpers.js';

describe('parseConfig', () => {
  it('reads asset, chunk and total budgets', () => {
    const config = parseConfig({
      compression: 'brotli',
      budgets: [
        { asset: 'assets/index-*.js', max: '150 KB' },
        { chunk: 'vendor', max: 200_000, compression: 'raw' },
      ],
      total: { max: '1 MB', compression: 'gzip' },
    });
    expect(config).toEqual({
      budgets: [
        { index: 0, target: 'asset', pattern: 'assets/index-*.js', max: 150_000, compression: 'brotli' },
        { index: 1, target: 'chunk', pattern: 'vendor', max: 200_000, compression: 'raw' },
      ],
      total: { max: 1_000_000, compression: 'gzip' },
    });
  });

  it('defaults to gzip', () => {
    const config = parseConfig({ budgets: [{ asset: '*.js', max: '1 KB' }], total: { max: '2 KB' } });
    expect(config.budgets[0]?.compression).toBe('gzip');
    expect(config.total?.compression).toBe('gzip');
  });

  it('allows a config with only a total budget', () => {
    expect(parseConfig({ total: { max: '1 MB' } })).toEqual({
      budgets: [],
      total: { max: 1_000_000, compression: 'gzip' },
    });
  });

  const invalid: [string, unknown, string][] = [
    ['a non-object', [], 'expected a JSON object'],
    ['an empty config', {}, 'define at least one entry in "budgets" or a "total" budget'],
    ['an unknown top-level field', { budget: [] }, 'budget: unknown field (allowed: compression, budgets, total)'],
    ['an invalid global compression', { compression: 'zip', total: { max: 1 } }, 'compression: invalid compression "zip" (expected one of: raw, gzip, brotli)'],
    ['budgets that are not an array', { budgets: {} }, 'budgets: expected an array'],
    ['a budget that is not an object', { budgets: ['*.js'] }, 'budgets[0]: expected an object'],
    ['a budget with neither target', { budgets: [{ max: '1 KB' }] }, 'budgets[0]: set exactly one of "asset" or "chunk"'],
    ['a budget with both targets', { budgets: [{ asset: 'a', chunk: 'b', max: '1 KB' }] }, 'budgets[0]: set exactly one of "asset" or "chunk"'],
    ['an empty pattern', { budgets: [{ chunk: ' ', max: '1 KB' }] }, 'budgets[0].chunk: expected a non-empty pattern string'],
    ['a pattern that is not a string', { budgets: [{ asset: 5, max: '1 KB' }] }, 'budgets[0].asset: expected a non-empty pattern string'],
    ['a missing max', { budgets: [{ asset: '*.js' }] }, 'budgets[0].max: is required'],
    ['an invalid max', { budgets: [{ asset: '*.js', max: '1 KB' }, { asset: '*.css', max: '15 kilobytes' }] }, 'budgets[1].max: invalid size "15 kilobytes"'],
    ['a zero max', { budgets: [{ asset: '*.js', max: 0 }] }, 'budgets[0].max: must be greater than 0'],
    ['an invalid budget compression', { budgets: [{ asset: '*.js', max: 1, compression: 'GZIP' }] }, 'budgets[0].compression: invalid compression "GZIP"'],
    ['an unknown budget field', { budgets: [{ asset: '*.js', max: 1, maxSize: 2 }] }, 'budgets[0].maxSize: unknown field (allowed: asset, chunk, max, compression)'],
    ['a total that is not an object', { total: '1 MB' }, 'total: expected an object'],
    ['a total without max', { total: {} }, 'total.max: is required'],
    ['an unknown total field', { total: { max: 1, files: '*.js' } }, 'total.files: unknown field (allowed: max, compression)'],
  ];

  it.each(invalid)('rejects %s', (_, data, message) => {
    expect(() => parseConfig(data)).toThrow(InputError);
    expect(() => parseConfig(data)).toThrow(message);
  });
});

describe('loadConfig', () => {
  it('loads a config file', () => {
    const config = loadConfig(fixturePath('configs', 'webpack-pass.json'));
    expect(config.budgets).toHaveLength(3);
    expect(config.total).toEqual({ max: 100_000, compression: 'brotli' });
  });

  it('names the file in validation errors', () => {
    expect(() => loadConfig(fixturePath('configs', 'invalid-size.json'))).toThrow(
      /^invalid config ".*invalid-size\.json": budgets\[1\]\.max: invalid size "15 kilobytes"/,
    );
  });

  it('reports a missing file', () => {
    expect(() => loadConfig('does-not-exist.json')).toThrow('cannot read config file "does-not-exist.json": file not found');
  });

  it('reports invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    const file = join(dir, 'config.json');
    writeFileSync(file, '{ "total": { "max": "1 MB" }, }');
    expect(() => loadConfig(file)).toThrow(/^config file ".*config\.json" is not valid JSON: /);
  });
});
