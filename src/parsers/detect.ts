import { InputError } from '../errors.js';
import type { Bundler } from '../model.js';
import { isRecord } from './shared.js';

const SUPPORTED_FORMATS =
  'expected webpack stats JSON (webpack --json) or rollup-plugin-visualizer raw-data JSON';

/** Works out which bundler produced a stats file from the shape of its JSON. */
export function detectFormat(data: unknown): Bundler {
  if (!isRecord(data)) {
    throw new InputError(`unrecognised stats format: ${SUPPORTED_FORMATS}`);
  }
  if (Array.isArray(data.chunks) && Array.isArray(data.assets)) {
    return 'webpack';
  }
  if ('tree' in data && 'nodeParts' in data && 'nodeMetas' in data) {
    if (data.version !== 2) {
      throw new InputError(
        `unsupported rollup-plugin-visualizer data version ${JSON.stringify(data.version)} (expected 2)`,
      );
    }
    return 'vite';
  }
  if (Array.isArray(data.children) && data.children.some((child) => isRecord(child) && 'chunks' in child)) {
    throw new InputError(
      'this looks like stats for a multi-compiler webpack build; write stats for a single compiler instead',
    );
  }
  if (isViteManifest(data)) {
    throw new InputError(
      'this looks like a Vite build manifest, which has no module information; ' +
        'generate stats with rollup-plugin-visualizer using template "raw-data"',
    );
  }
  throw new InputError(`unrecognised stats format: ${SUPPORTED_FORMATS}`);
}

function isViteManifest(data: Record<string, unknown>): boolean {
  const entries = Object.values(data);
  return entries.length > 0 && entries.every((entry) => isRecord(entry) && typeof entry.file === 'string');
}
