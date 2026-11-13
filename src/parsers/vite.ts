import { InputError } from '../errors.js';
import type { BuildStats, Chunk, ModuleInfo } from '../model.js';
import { isRecord, packageName } from './shared.js';

/**
 * Reads the JSON written by rollup-plugin-visualizer with `template: "raw-data"` (data version 2).
 *
 * `tree.children` lists the output chunks by file name. `nodeMetas` describes each module and
 * points, per chunk file, at an entry in `nodeParts` that holds the module's rendered length.
 */
export function parseViteStats(data: unknown): BuildStats {
  if (!isRecord(data) || !isRecord(data.tree) || !isRecord(data.nodeParts) || !isRecord(data.nodeMetas)) {
    throw new InputError('visualizer data: expected "tree", "nodeParts" and "nodeMetas" objects');
  }
  const { nodeParts, nodeMetas } = data;
  const bundles: unknown[] = Array.isArray(data.tree.children) ? data.tree.children : [];

  const files = bundles.map((bundle, index) => {
    if (!isRecord(bundle) || typeof bundle.name !== 'string') {
      throw new InputError(`visualizer data: tree.children[${index}].name is missing`);
    }
    return bundle.name;
  });

  const modulesByFile = new Map<string, ModuleInfo[]>(files.map((file) => [file, []]));
  const entryFiles = new Set<string>();

  for (const [uid, meta] of Object.entries(nodeMetas)) {
    if (!isRecord(meta) || typeof meta.id !== 'string' || !isRecord(meta.moduleParts)) {
      throw new InputError(`visualizer data: nodeMetas["${uid}"] is missing "id" or "moduleParts"`);
    }
    // Rollup marks virtual modules with a leading NUL character.
    const id = meta.id.replace(/^\0/, '');

    for (const [file, partUid] of Object.entries(meta.moduleParts)) {
      const part = typeof partUid === 'string' ? nodeParts[partUid] : undefined;
      if (!isRecord(part) || typeof part.renderedLength !== 'number') {
        throw new InputError(`visualizer data: nodeParts entry for module "${id}" in "${file}" is missing`);
      }
      if (meta.isEntry === true) entryFiles.add(file);
      // Modules that were tree-shaken away still have a part, with nothing rendered.
      if (part.renderedLength === 0) continue;
      modulesByFile.get(file)?.push({ id, package: packageName(id), size: part.renderedLength });
    }
  }

  const chunks: Chunk[] = files.map((file) => ({
    name: chunkNameFromFile(file),
    files: [file],
    entry: entryFiles.has(file),
    modules: modulesByFile.get(file) ?? [],
  }));

  return { bundler: 'vite', chunks, files };
}

/**
 * The visualizer data has no chunk names, so they are taken from file names using Vite's
 * default "[name]-[hash].js" pattern: "assets/index-D1LtzFCC.js" -> "index".
 */
export function chunkNameFromFile(file: string): string {
  const base = file.slice(file.lastIndexOf('/') + 1).replace(/\.[cm]?js$/, '');
  return base.replace(/-[\w-]{8}$/, '');
}
