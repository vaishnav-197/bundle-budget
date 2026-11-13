#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { allPassed, runCheck } from './check.js';
import { shouldUseColor } from './color.js';
import { DEFAULT_CONFIG_FILE, loadConfig } from './config.js';
import { InputError, UsageError } from './errors.js';
import { formatJson, formatTable } from './report.js';

const HELP = `Usage: bundle-budget check <stats-file> --dir <build-dir> [options]

Checks the bundle sizes of a Vite or Webpack build against the budgets in a config file.

Arguments:
  <stats-file>          webpack stats JSON (webpack --json) or
                        rollup-plugin-visualizer raw-data JSON (Vite)

Options:
  -d, --dir <path>      build output directory to measure (required)
  -c, --config <path>   config file (default: ${DEFAULT_CONFIG_FILE})
      --json            print the report as JSON
      --verbose         also list the largest packages in each chunk
  -h, --help            show this help
  -v, --version         show the version number

Exit codes:
  0  all budgets passed
  1  at least one budget was exceeded
  2  usage, config or input error
`;

const OPTIONS = {
  dir: { type: 'string', short: 'd' },
  config: { type: 'string', short: 'c' },
  json: { type: 'boolean' },
  verbose: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

function parseCommandLine(args: string[]) {
  try {
    return parseArgs({ args, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

function readVersion(): string {
  const pkg: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return typeof pkg === 'object' && pkg !== null && 'version' in pkg ? String(pkg.version) : 'unknown';
}

function main(args: string[]): number {
  const { values, positionals } = parseCommandLine(args);

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }

  const [command, statsFile, ...extra] = positionals;
  if (command === undefined) throw new UsageError('missing command');
  if (command !== 'check') throw new UsageError(`unknown command "${command}"`);
  if (statsFile === undefined) throw new UsageError('missing <stats-file>');
  if (extra.length > 0) throw new UsageError(`unexpected argument "${extra[0]}"`);
  if (values.dir === undefined) throw new UsageError('missing required option --dir <build-dir>');

  const config = loadConfig(values.config ?? DEFAULT_CONFIG_FILE);
  const report = runCheck(statsFile, values.dir, config);

  process.stdout.write(
    values.json
      ? formatJson(report)
      : formatTable(report, {
          color: shouldUseColor(process.stdout.isTTY, process.env),
          verbose: values.verbose === true,
        }),
  );
  return allPassed(report) ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`bundle-budget: ${error.message}\nRun "bundle-budget --help" for usage.\n`);
  } else if (error instanceof InputError) {
    process.stderr.write(`bundle-budget: ${error.message}\n`);
  } else {
    process.stderr.write(`bundle-budget: unexpected error\n${error instanceof Error ? error.stack : String(error)}\n`);
  }
  process.exitCode = 2;
}
