import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROOT } from './helpers.js';

const CLI = join(ROOT, 'dist', 'cli.js');

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[], options: { cwd?: string } = {}): RunResult {
  const env = { ...process.env };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: options.cwd ?? ROOT, env, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const webpackArgs = ['check', 'fixtures/webpack-app/stats.json', '--dir', 'fixtures/webpack-app/dist'];
const viteArgs = ['check', 'fixtures/vite-app/stats.json', '--dir', 'fixtures/vite-app/dist'];

beforeAll(() => {
  if (!existsSync(CLI)) throw new Error('dist/cli.js not found. Run "npm run build" before the tests.');
});

describe('bundle-budget check', () => {
  it('exits with 0 when every budget passes', () => {
    const result = run([...webpackArgs, '--config', 'fixtures/configs/webpack-pass.json']);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(
      [
        'webpack build in fixtures/webpack-app/dist (8 files)',
        '',
        '      Budget              Target                         Size      Limit  Used  Compression',
        'PASS  asset js/main.*.js  js/main.d30a747b.js         2.41 KB   10.00 KB   24%  gzip',
        'PASS  chunk vendor        vendor                     74.58 KB  100.00 KB   75%  gzip',
        'PASS  asset css/*.css     css/main.e5ec08f4.css         180 B    2.00 KB    9%  raw',
        'PASS  asset css/*.css     css/settings.4da09bda.css     124 B    2.00 KB    6%  raw',
        'PASS  total               6 JS/CSS files             72.81 KB  100.00 KB   73%  brotli',
        '',
        'All 5 checks passed.',
        '',
      ].join('\n'),
    );
  });

  it('exits with 1 when a budget is exceeded', () => {
    const result = run([...viteArgs, '-c', 'fixtures/configs/vite-fail.json']);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('FAIL  chunk index         index                         75.05 KB  70.00 KB  107%  gzip');
    expect(result.stdout).toContain('\n1 of 5 checks over budget.\n');
  });

  it('prints no colour codes when stdout is not a terminal', () => {
    const result = run([...viteArgs, '-c', 'fixtures/configs/vite-fail.json']);
    expect(result.stdout).not.toContain('\u001b[');
  });

  it('reads bundle-budget.config.json from the working directory by default', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    writeFileSync(join(cwd, 'bundle-budget.config.json'), JSON.stringify({ total: { max: '1 KB' } }));
    const result = run(['check', join(ROOT, 'fixtures/vite-app/stats.json'), '--dir', join(ROOT, 'fixtures/vite-app/dist')], { cwd });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('FAIL  total');
  });

  it('prints JSON with --json', () => {
    const result = run([...webpackArgs, '-c', 'fixtures/configs/webpack-pass.json', '--json']);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.bundler).toBe('webpack');
    expect(output.passed).toBe(true);
    expect(output.budgets).toHaveLength(5);
    expect(output.assets).toHaveLength(8);
    const vendor = output.chunks.find((chunk: { name: string }) => chunk.name === 'vendor');
    expect(vendor.packages[0]).toEqual({ name: 'react-dom', size: expect.any(Number) });
  });

  it('keeps the exit code at 1 with --json when a budget fails', () => {
    const result = run([...viteArgs, '-c', 'fixtures/configs/vite-fail.json', '--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).passed).toBe(false);
  });

  it('lists packages per chunk with --verbose', () => {
    const result = run([...viteArgs, '-c', 'fixtures/configs/vite-fail.json', '--verbose']);
    expect(result.stdout).toContain('  index (entry)  assets/index-D1LtzFCC.js\n    react-dom');
    expect(result.stdout).toContain('  Settings  assets/Settings-Bw2Hwa_q.js\n    lodash-es');
  });
});

describe('errors (exit code 2)', () => {
  const expectError = (result: RunResult, message: string | RegExp) => {
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(message);
  };

  it('reports an invalid config', () => {
    expectError(
      run([...webpackArgs, '-c', 'fixtures/configs/invalid-size.json']),
      'bundle-budget: invalid config "fixtures/configs/invalid-size.json": budgets[1].max: invalid size "15 kilobytes"',
    );
  });

  it('reports a missing config file', () => {
    expectError(
      run([...webpackArgs, '-c', 'missing.json']),
      'bundle-budget: cannot read config file "missing.json": file not found\n',
    );
  });

  it('reports a pattern that matches nothing', () => {
    expectError(
      run([...webpackArgs, '-c', 'fixtures/configs/no-match.json']),
      'bundle-budget: budgets[0]: asset pattern "static/app-*.js" matched no files in the build\n',
    );
  });

  it('reports malformed stats', () => {
    expectError(
      run(['check', 'fixtures/edge/malformed.json', '--dir', 'fixtures/vite-app/dist', '-c', 'fixtures/configs/total-only.json']),
      /^bundle-budget: stats file "fixtures\/edge\/malformed\.json" is not valid JSON: /,
    );
  });

  it('reports an unknown stats format', () => {
    expectError(
      run(['check', 'fixtures/edge/unknown-format.json', '--dir', 'fixtures/vite-app/dist', '-c', 'fixtures/configs/total-only.json']),
      /^bundle-budget: unrecognised stats format: expected webpack stats JSON/,
    );
  });

  it('reports files missing from the build directory', () => {
    expectError(
      run([
        'check',
        'fixtures/edge/missing-asset/stats.json',
        '--dir',
        'fixtures/edge/missing-asset/dist',
        '-c',
        'fixtures/configs/total-only.json',
      ]),
      'bundle-budget: a file listed in the stats is missing from "fixtures/edge/missing-asset/dist": js/lazy.js.',
    );
  });

  it.each([
    [[], 'bundle-budget: missing command'],
    [['build'], 'bundle-budget: unknown command "build"'],
    [['check'], 'bundle-budget: missing <stats-file>'],
    [['check', 'stats.json'], 'bundle-budget: missing required option --dir <build-dir>'],
    [['check', 'a.json', 'b.json', '--dir', 'dist'], 'bundle-budget: unexpected argument "b.json"'],
    [['check', 'stats.json', '--dir'], /^bundle-budget: Option '-d, --dir <value>' argument missing/],
    [['check', 'stats.json', '--dir', 'dist', '--colour'], /^bundle-budget: Unknown option '--colour'/],
  ])('reports a usage error for %j', (args, message) => {
    const result = run(args);
    expectError(result, message);
    expect(result.stderr).toContain('Run "bundle-budget --help" for usage.\n');
  });
});

describe('--help and --version', () => {
  it('prints help', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^Usage: bundle-budget check <stats-file> --dir <build-dir> \[options\]/);
    expect(result.stdout).toContain('--json');
    expect(result.stdout).toContain('Exit codes:');
  });

  it('prints the version from package.json', () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    for (const flag of ['--version', '-v']) {
      const result = run([flag]);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${version}\n`);
    }
  });
});
