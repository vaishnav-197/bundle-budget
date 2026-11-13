import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyBudgets, type BudgetResult } from './budgets.js';
import type { Config } from './config.js';
import { InputError } from './errors.js';
import { listBuildFiles, measureFiles } from './measure.js';
import type { Bundler, Chunk, MeasuredAsset } from './model.js';
import { parseStats } from './parsers/index.js';
import { readJsonFile } from './read-json.js';

export interface CheckReport {
  bundler: Bundler;
  dir: string;
  results: BudgetResult[];
  assets: MeasuredAsset[];
  chunks: Chunk[];
}

/** Reads the stats, measures the build directory and applies the budgets. */
export function runCheck(statsFile: string, dir: string, config: Config): CheckReport {
  const stats = parseStats(readJsonFile(statsFile, 'stats file'));

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new InputError(`build directory "${dir}" does not exist or is not a directory`);
  }
  const missing = stats.files.filter((file) => !file.endsWith('.map') && !existsSync(join(dir, file)));
  if (missing.length > 0) {
    throw new InputError(
      `${missing.length === 1 ? 'a file' : 'files'} listed in the stats ${missing.length === 1 ? 'is' : 'are'} ` +
        `missing from "${dir}": ${missing.join(', ')}. Were the stats generated from this build?`,
    );
  }

  // The stats file may have been written into the build directory; it is not part of the bundle.
  const files = listBuildFiles(dir, new Set([resolve(statsFile)]));
  const assets = measureFiles(dir, files);

  return { bundler: stats.bundler, dir, results: applyBudgets(config, stats, assets), assets, chunks: stats.chunks };
}

export function allPassed(report: CheckReport): boolean {
  return report.results.every((result) => result.passed);
}
