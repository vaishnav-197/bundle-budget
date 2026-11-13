import { InputError } from './errors.js';
import { COMPRESSIONS, type Compression } from './model.js';
import { isRecord } from './parsers/shared.js';
import { readJsonFile } from './read-json.js';
import { parseSize } from './size.js';

export const DEFAULT_CONFIG_FILE = 'bundle-budget.config.json';

export interface BudgetRule {
  /** Position in the config's "budgets" array, used in messages. */
  index: number;
  target: 'asset' | 'chunk';
  pattern: string;
  max: number;
  compression: Compression;
}

export interface TotalBudget {
  max: number;
  compression: Compression;
}

export interface Config {
  budgets: BudgetRule[];
  total: TotalBudget | null;
}

const SIZE_HINT = 'use a number of bytes or a string such as "150 KB", "1.2 MB" or "100 KiB"';

export function loadConfig(path: string): Config {
  const data = readJsonFile(path, 'config file');
  try {
    return parseConfig(data);
  } catch (error) {
    if (error instanceof InputError) throw new InputError(`invalid config "${path}": ${error.message}`);
    throw error;
  }
}

export function parseConfig(data: unknown): Config {
  if (!isRecord(data)) fail('', 'expected a JSON object');
  rejectUnknownFields(data, ['compression', 'budgets', 'total'], '');

  const compression = data.compression === undefined ? 'gzip' : parseCompression(data.compression, 'compression');

  if (data.budgets !== undefined && !Array.isArray(data.budgets)) fail('budgets', 'expected an array');
  const rawBudgets: unknown[] = data.budgets ?? [];
  const budgets = rawBudgets.map((raw, index) => parseBudget(raw, index, compression));
  const total = data.total === undefined ? null : parseTotal(data.total, compression);

  if (budgets.length === 0 && total === null) {
    fail('', 'define at least one entry in "budgets" or a "total" budget');
  }
  return { budgets, total };
}

function parseBudget(raw: unknown, index: number, defaultCompression: Compression): BudgetRule {
  const path = `budgets[${index}]`;
  if (!isRecord(raw)) fail(path, 'expected an object');
  rejectUnknownFields(raw, ['asset', 'chunk', 'max', 'compression'], path);

  if ((raw.asset === undefined) === (raw.chunk === undefined)) {
    fail(path, 'set exactly one of "asset" or "chunk"');
  }
  const target = raw.asset === undefined ? 'chunk' : 'asset';
  const pattern = raw[target];
  if (typeof pattern !== 'string' || pattern.trim() === '') {
    fail(`${path}.${target}`, 'expected a non-empty pattern string');
  }

  return {
    index,
    target,
    pattern,
    max: parseMax(raw.max, `${path}.max`),
    compression: raw.compression === undefined ? defaultCompression : parseCompression(raw.compression, `${path}.compression`),
  };
}

function parseTotal(raw: unknown, defaultCompression: Compression): TotalBudget {
  if (!isRecord(raw)) fail('total', 'expected an object');
  rejectUnknownFields(raw, ['max', 'compression'], 'total');
  return {
    max: parseMax(raw.max, 'total.max'),
    compression: raw.compression === undefined ? defaultCompression : parseCompression(raw.compression, 'total.compression'),
  };
}

function parseMax(value: unknown, path: string): number {
  if (value === undefined) fail(path, `is required (${SIZE_HINT})`);
  const bytes = parseSize(value);
  if (bytes === null) fail(path, `invalid size ${JSON.stringify(value)} (${SIZE_HINT})`);
  if (bytes === 0) fail(path, 'must be greater than 0');
  return bytes;
}

function parseCompression(value: unknown, path: string): Compression {
  if (typeof value === 'string' && (COMPRESSIONS as readonly string[]).includes(value)) {
    return value as Compression;
  }
  fail(path, `invalid compression ${JSON.stringify(value)} (expected one of: ${COMPRESSIONS.join(', ')})`);
}

function rejectUnknownFields(object: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      fail(path ? `${path}.${key}` : key, `unknown field (allowed: ${allowed.join(', ')})`);
    }
  }
}

function fail(path: string, problem: string): never {
  throw new InputError(path ? `${path}: ${problem}` : problem);
}
