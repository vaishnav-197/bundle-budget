import { InputError } from '../errors.js';
import type { BuildStats, Chunk, ModuleInfo } from '../model.js';
import { isRecord, isStringArray, packageName } from './shared.js';

/** Reads the stats JSON written by `webpack --json`. */
export function parseWebpackStats(data: unknown): BuildStats {
  if (!isRecord(data) || !Array.isArray(data.chunks) || !Array.isArray(data.assets)) {
    throw new InputError('webpack stats: expected "chunks" and "assets" arrays');
  }
  const topLevelModules: unknown[] = Array.isArray(data.modules) ? data.modules : [];
  const chunks = data.chunks.map((chunk, index) => parseChunk(chunk, index, topLevelModules));

  const files = new Set<string>();
  data.assets.forEach((asset, index) => {
    if (!isRecord(asset) || typeof asset.name !== 'string') {
      throw new InputError(`webpack stats: assets[${index}].name is missing`);
    }
    files.add(asset.name);
  });
  for (const chunk of chunks) {
    for (const file of chunk.files) files.add(file);
  }

  return { bundler: 'webpack', chunks, files: [...files] };
}

function parseChunk(raw: unknown, index: number, topLevelModules: unknown[]): Chunk {
  const where = `webpack stats: chunks[${index}]`;
  if (!isRecord(raw)) throw new InputError(`${where} is not an object`);

  const { id, names, files } = raw;
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new InputError(`${where}.id is missing`);
  }
  if (!isStringArray(files)) {
    throw new InputError(`${where}.files must be an array of strings`);
  }

  // Chunks list their modules when `chunkModules` is on (the default for --json);
  // otherwise fall back to the top-level module list.
  const members = Array.isArray(raw.modules)
    ? raw.modules
    : topLevelModules.filter((module) => isRecord(module) && Array.isArray(module.chunks) && module.chunks.includes(id));

  return {
    // Chunks without a webpackChunkName are known only by their id.
    name: isStringArray(names) && names[0] !== undefined ? names[0] : String(id),
    files,
    entry: raw.entry === true,
    modules: members.flatMap(flattenModule),
  };
}

// A concatenated module (scope hoisting) lists the modules it contains under `modules`.
function flattenModule(raw: unknown): ModuleInfo[] {
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw.modules)) return raw.modules.flatMap(flattenModule);
  if (typeof raw.name !== 'string' || typeof raw.size !== 'number') return [];
  return [{ id: raw.name, package: packageName(raw.name), size: raw.size }];
}
