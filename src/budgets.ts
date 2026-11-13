import type { BudgetRule, Config, TotalBudget } from './config.js';
import { InputError } from './errors.js';
import { matchGlob } from './glob.js';
import type { BuildStats, Chunk, Compression, MeasuredAsset } from './model.js';

export interface BudgetResult {
  kind: 'asset' | 'chunk' | 'total';
  /** The budget as written in the config, e.g. "asset assets/index-*.js". */
  budget: string;
  /** The file or chunk the size belongs to. */
  target: string;
  compression: Compression;
  size: number;
  max: number;
  passed: boolean;
}

const JS_FILE = /\.[cm]?js$/;
const CSS_FILE = /\.css$/;

export function applyBudgets(config: Config, stats: BuildStats, assets: readonly MeasuredAsset[]): BudgetResult[] {
  const results = config.budgets.flatMap((rule) =>
    rule.target === 'asset' ? checkAssetRule(rule, assets) : checkChunkRule(rule, stats.chunks, assets),
  );
  if (config.total) results.push(checkTotal(config.total, assets));
  return results;
}

/** Every asset that matches the pattern is checked against the budget on its own. */
function checkAssetRule(rule: BudgetRule, assets: readonly MeasuredAsset[]): BudgetResult[] {
  const matches = assets.filter((asset) => matchGlob(rule.pattern, asset.file));
  if (matches.length === 0) {
    throw new InputError(`budgets[${rule.index}]: asset pattern "${rule.pattern}" matched no files in the build`);
  }
  return matches.map((asset) => result('asset', `asset ${rule.pattern}`, asset.file, asset[rule.compression], rule));
}

/** A chunk's size is the sum of its JavaScript files. */
function checkChunkRule(rule: BudgetRule, chunks: readonly Chunk[], assets: readonly MeasuredAsset[]): BudgetResult[] {
  const matches = chunks.filter((chunk) => matchGlob(rule.pattern, chunk.name));
  if (matches.length === 0) {
    throw new InputError(`budgets[${rule.index}]: chunk pattern "${rule.pattern}" matched no chunks in the stats`);
  }
  const byFile = new Map(assets.map((asset) => [asset.file, asset]));
  return matches.map((chunk) => {
    const size = chunk.files
      .filter((file) => JS_FILE.test(file))
      .reduce((sum, file) => {
        const asset = byFile.get(file);
        if (!asset) throw new InputError(`chunk "${chunk.name}" lists "${file}", which is not in the build directory`);
        return sum + asset[rule.compression];
      }, 0);
    return result('chunk', `chunk ${rule.pattern}`, chunk.name, size, rule);
  });
}

/** The total covers all JavaScript and CSS files, each compressed on its own. */
function checkTotal(total: TotalBudget, assets: readonly MeasuredAsset[]): BudgetResult {
  const counted = assets.filter((asset) => JS_FILE.test(asset.file) || CSS_FILE.test(asset.file));
  const size = counted.reduce((sum, asset) => sum + asset[total.compression], 0);
  const target = `${counted.length} JS/CSS ${counted.length === 1 ? 'file' : 'files'}`;
  return result('total', 'total', target, size, total);
}

function result(
  kind: BudgetResult['kind'],
  budget: string,
  target: string,
  size: number,
  limit: { max: number; compression: Compression },
): BudgetResult {
  return { kind, budget, target, compression: limit.compression, size, max: limit.max, passed: size <= limit.max };
}
