export type Compression = 'raw' | 'gzip' | 'brotli';

export const COMPRESSIONS: readonly Compression[] = ['raw', 'gzip', 'brotli'];

export type Bundler = 'webpack' | 'vite';

/** A source module inside a chunk. `size` is measured before minification. */
export interface ModuleInfo {
  id: string;
  /** npm package the module belongs to, or null for application code. */
  package: string | null;
  size: number;
}

export interface Chunk {
  name: string;
  /** Output files of the chunk, relative to the build directory. */
  files: string[];
  entry: boolean;
  modules: ModuleInfo[];
}

/** What the tool needs from a stats file, independent of the bundler. */
export interface BuildStats {
  bundler: Bundler;
  chunks: Chunk[];
  /** Every output file the stats refer to, relative to the build directory. */
  files: string[];
}

/** Sizes in bytes of one file in the build directory. */
export interface MeasuredAsset {
  file: string;
  raw: number;
  gzip: number;
  brotli: number;
}
