import type { BudgetResult } from './budgets.js';
import { allPassed, type CheckReport } from './check.js';
import { createColors, type Colors } from './color.js';
import type { ModuleInfo } from './model.js';
import { formatSize } from './size.js';

export interface TableOptions {
  color: boolean;
  /** Also list the packages in each chunk. */
  verbose: boolean;
}

export interface PackageSize {
  /** npm package name, or "(app code)" for modules outside node_modules. */
  name: string;
  size: number;
}

const APP_CODE = '(app code)';
const TOP_PACKAGES = 5;

/** Groups a chunk's modules by package, largest first. Sizes are before minification. */
export function packageSizes(modules: readonly ModuleInfo[]): PackageSize[] {
  const sizes = new Map<string, number>();
  for (const module of modules) {
    const name = module.package ?? APP_CODE;
    sizes.set(name, (sizes.get(name) ?? 0) + module.size);
  }
  return [...sizes]
    .map(([name, size]) => ({ name, size }))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

export function usagePercent(size: number, max: number): string {
  return `${Math.round((size / max) * 100)}%`;
}

export function formatTable(report: CheckReport, options: TableOptions): string {
  const colors = createColors(options.color);
  const lines = [
    colors.dim(`${report.bundler} build in ${report.dir} (${report.assets.length} files)`),
    '',
    ...formatResults(report.results, colors),
    '',
    formatSummary(report, colors),
  ];
  if (options.verbose) lines.push('', ...formatChunks(report, colors));
  return `${lines.join('\n')}\n`;
}

function formatResults(results: readonly BudgetResult[], colors: Colors): string[] {
  const header = ['', 'Budget', 'Target', 'Size', 'Limit', 'Used', 'Compression'];
  const rows = results.map((r) => [
    r.passed ? 'PASS' : 'FAIL',
    r.budget,
    r.target,
    formatSize(r.size),
    formatSize(r.max),
    usagePercent(r.size, r.max),
    r.compression,
  ]);
  const widths = header.map((cell, column) => Math.max(cell.length, ...rows.map((row) => row[column]?.length ?? 0)));
  // Size, Limit and Used are right-aligned so the numbers line up.
  const rightAligned = new Set([3, 4, 5]);
  const layout = (row: readonly string[]) =>
    row.map((cell, column) => {
      const width = widths[column] ?? 0;
      return rightAligned.has(column) ? cell.padStart(width) : cell.padEnd(width);
    });

  const lines = [colors.dim(layout(header).join('  ').trimEnd())];
  results.forEach((result, index) => {
    const cells = layout(rows[index] ?? []);
    const paint = result.passed ? colors.green : (text: string) => colors.bold(colors.red(text));
    cells[0] = paint(cells[0] ?? '');
    if (!result.passed) cells[3] = colors.red(cells[3] ?? '');
    lines.push(cells.join('  ').trimEnd());
  });
  return lines;
}

function formatSummary(report: CheckReport, colors: Colors): string {
  // One budget can produce several checks, e.g. an asset pattern that matches two files.
  const count = report.results.length;
  const failed = report.results.filter((r) => !r.passed).length;
  if (allPassed(report)) return colors.green(count === 1 ? '1 check passed.' : `All ${count} checks passed.`);
  return colors.red(`${failed} of ${count} ${count === 1 ? 'check' : 'checks'} over budget.`);
}

function formatChunks(report: CheckReport, colors: Colors): string[] {
  const lines = [colors.bold('Chunks') + colors.dim(' (module sizes before minification)')];
  for (const chunk of report.chunks) {
    const label = chunk.entry ? `${chunk.name} (entry)` : chunk.name;
    lines.push('', `  ${colors.bold(label)}  ${colors.dim(chunk.files.join(', '))}`);
    const packages = packageSizes(chunk.modules);
    const width = Math.max(0, ...packages.slice(0, TOP_PACKAGES).map((p) => p.name.length));
    for (const pkg of packages.slice(0, TOP_PACKAGES)) {
      lines.push(`    ${pkg.name.padEnd(width)}  ${formatSize(pkg.size).padStart(9)}`);
    }
    if (packages.length > TOP_PACKAGES) {
      lines.push(colors.dim(`    ... and ${packages.length - TOP_PACKAGES} more`));
    }
  }
  return lines;
}

export function formatJson(report: CheckReport): string {
  const output = {
    bundler: report.bundler,
    passed: allPassed(report),
    budgets: report.results,
    assets: report.assets,
    chunks: report.chunks.map((chunk) => ({
      name: chunk.name,
      entry: chunk.entry,
      files: chunk.files,
      packages: packageSizes(chunk.modules),
    })),
  };
  return `${JSON.stringify(output, null, 2)}\n`;
}
