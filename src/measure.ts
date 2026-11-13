import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import type { MeasuredAsset } from './model.js';

/** gzip at level 9 and brotli at quality 11: the settings commonly used for precompressed assets. */
export function measureContent(file: string, content: Buffer): MeasuredAsset {
  const gzip = gzipSync(content, { level: 9 });
  const brotli = brotliCompressSync(content, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: content.length,
    },
  });
  return { file, raw: content.length, gzip: gzip.length, brotli: brotli.length };
}

/**
 * Lists the files in a build directory as "/"-separated paths relative to it, sorted.
 * Source maps, hidden files and hidden directories (such as Vite's ".vite/") are skipped,
 * as is any absolute path in `exclude`.
 */
export function listBuildFiles(dir: string, exclude: ReadonlySet<string> = new Set()): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const absolute = resolve(entry.parentPath, entry.name);
    const path = relative(dir, absolute).split(sep).join('/');
    const hidden = path.split('/').some((segment) => segment.startsWith('.'));
    if (hidden || path.endsWith('.map') || exclude.has(absolute)) continue;
    files.push(path);
  }
  return files.sort();
}

export function measureFiles(dir: string, files: readonly string[]): MeasuredAsset[] {
  return files.map((file) => measureContent(file, readFileSync(join(dir, file))));
}
