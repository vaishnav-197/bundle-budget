import type { BuildStats } from '../model.js';
import { detectFormat } from './detect.js';
import { parseViteStats } from './vite.js';
import { parseWebpackStats } from './webpack.js';

export function parseStats(data: unknown): BuildStats {
  return detectFormat(data) === 'webpack' ? parseWebpackStats(data) : parseViteStats(data);
}
