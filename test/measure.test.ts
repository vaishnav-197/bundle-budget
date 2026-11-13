import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { listBuildFiles, measureContent, measureFiles } from '../src/measure.js';
import { fixturePath } from './helpers.js';

describe('measureContent', () => {
  it('reports raw, gzip and brotli sizes', () => {
    const content = Buffer.from('const greeting = "hello";\n'.repeat(200));
    const measured = measureContent('a.js', content);
    expect(measured.file).toBe('a.js');
    expect(measured.raw).toBe(content.length);
    expect(measured.gzip).toBe(gzipSync(content, { level: 9 }).length);
    expect(measured.brotli).toBe(
      brotliCompressSync(content, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: content.length },
      }).length,
    );
    expect(measured.brotli).toBeLessThan(measured.gzip);
    expect(measured.gzip).toBeLessThan(measured.raw);
  });

  it('handles empty files', () => {
    const measured = measureContent('empty.js', Buffer.alloc(0));
    expect(measured.raw).toBe(0);
    expect(measured.gzip).toBeGreaterThan(0);
  });
});

describe('listBuildFiles', () => {
  it('lists the sample build with relative paths', () => {
    expect(listBuildFiles(fixturePath('webpack-app', 'dist'))).toEqual([
      'css/main.e5ec08f4.css',
      'css/settings.4da09bda.css',
      'index.html',
      'js/760.c1a5d7c9.js',
      'js/main.d30a747b.js',
      'js/settings.946e0f38.js',
      'js/vendor.99cc4b83.js',
      'js/vendor.99cc4b83.js.LICENSE.txt',
    ]);
  });

  it('skips source maps, hidden files and excluded files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    mkdirSync(join(dir, 'assets'));
    mkdirSync(join(dir, '.vite'));
    for (const file of ['assets/app.js', 'assets/app.js.map', '.vite/manifest.json', '.DS_Store', 'stats.json']) {
      writeFileSync(join(dir, file), 'x');
    }
    expect(listBuildFiles(dir, new Set([join(dir, 'stats.json')]))).toEqual(['assets/app.js']);
  });

  it('returns nothing for an empty directory', () => {
    expect(listBuildFiles(mkdtempSync(join(tmpdir(), 'bundle-budget-')))).toEqual([]);
  });
});

describe('measureFiles', () => {
  it('measures the real files on disk', () => {
    const dir = fixturePath('vite-app', 'dist');
    const [css] = measureFiles(dir, ['assets/index-jKOD1Osa.css']);
    expect(css?.raw).toBe(readFileSync(join(dir, 'assets/index-jKOD1Osa.css')).length);
  });
});
