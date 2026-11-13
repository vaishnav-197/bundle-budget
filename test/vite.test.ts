import { describe, expect, it } from 'vitest';
import type { Chunk } from '../src/model.js';
import { chunkNameFromFile, parseViteStats } from '../src/parsers/vite.js';
import { readFixture } from './helpers.js';

describe('parseViteStats with the sample app', () => {
  const stats = parseViteStats(readFixture('vite-app', 'stats.json'));
  const [index, settings] = stats.chunks;

  it('reads one chunk per output file', () => {
    expect(stats.bundler).toBe('vite');
    expect(stats.files).toEqual(['assets/index-D1LtzFCC.js', 'assets/Settings-Bw2Hwa_q.js']);
    expect(stats.chunks.map((c) => [c.name, c.files])).toEqual([
      ['index', ['assets/index-D1LtzFCC.js']],
      ['Settings', ['assets/Settings-Bw2Hwa_q.js']],
    ]);
  });

  it('marks the chunk that contains the entry module', () => {
    expect(index?.entry).toBe(true);
    expect(settings?.entry).toBe(false);
  });

  it('assigns packages to the chunks they ended up in', () => {
    const packages = (chunk?: Chunk) => new Set((chunk?.modules ?? []).map((m) => m.package));
    expect(packages(index)).toEqual(new Set([null, 'react', 'react-dom', 'scheduler', 'date-fns', 'lodash-es']));
    expect(packages(settings)).toEqual(new Set([null, 'date-fns', 'lodash-es']));
  });

  it('uses the rendered length as the module size', () => {
    const app = index?.modules.find((m) => m.id === '/src/App.jsx');
    expect(app?.size).toBeGreaterThan(0);
    expect(index?.modules.every((m) => m.size > 0)).toBe(true);
  });

  it('strips the marker from virtual module ids', () => {
    expect(index?.modules.some((m) => m.id === 'vite/modulepreload-polyfill.js')).toBe(true);
    expect(index?.modules.some((m) => m.id.startsWith('\0'))).toBe(false);
  });
});

describe('parseViteStats with hand-written data', () => {
  const data = {
    version: 2,
    tree: { name: 'root', children: [{ name: 'assets/main-AbCd1234.js', children: [] }] },
    nodeParts: {
      p1: { renderedLength: 120, gzipLength: 0, brotliLength: 0, metaUid: 'm1' },
      p2: { renderedLength: 0, gzipLength: 0, brotliLength: 0, metaUid: 'm2' },
    },
    nodeMetas: {
      m1: { id: '/node_modules/.pnpm/lit@3.0.0/node_modules/lit/index.js', moduleParts: { 'assets/main-AbCd1234.js': 'p1' } },
      m2: { id: '/src/unused.js', moduleParts: { 'assets/main-AbCd1234.js': 'p2' } },
      m3: { id: '/src/not-bundled.js', moduleParts: {} },
    },
  };

  it('skips tree-shaken modules and resolves pnpm paths', () => {
    expect(parseViteStats(data).chunks).toEqual([
      {
        name: 'main',
        files: ['assets/main-AbCd1234.js'],
        entry: false,
        modules: [{ id: '/node_modules/.pnpm/lit@3.0.0/node_modules/lit/index.js', package: 'lit', size: 120 }],
      },
    ]);
  });

  it('reads a build with no chunks', () => {
    expect(parseViteStats({ version: 2, tree: { name: 'root', children: [] }, nodeParts: {}, nodeMetas: {} })).toEqual({
      bundler: 'vite',
      chunks: [],
      files: [],
    });
  });

  it.each([
    ['missing sections', { tree: {} }, 'visualizer data: expected "tree", "nodeParts" and "nodeMetas" objects'],
    ['a bundle without a name', { ...data, tree: { children: [{}] } }, 'visualizer data: tree.children[0].name is missing'],
    ['a module without an id', { ...data, nodeMetas: { m1: { moduleParts: {} } } }, 'visualizer data: nodeMetas["m1"] is missing "id" or "moduleParts"'],
    [
      'a module pointing at a missing part',
      { ...data, nodeMetas: { m1: { id: '/src/a.js', moduleParts: { 'assets/main-AbCd1234.js': 'nope' } } } },
      'visualizer data: nodeParts entry for module "/src/a.js" in "assets/main-AbCd1234.js" is missing',
    ],
  ])('rejects %s', (_, input, message) => {
    expect(() => parseViteStats(input)).toThrow(message);
  });
});

describe('chunkNameFromFile', () => {
  it.each([
    ['assets/index-D1LtzFCC.js', 'index'],
    ['assets/Settings-Bw2Hwa_q.js', 'Settings'],
    ['assets/date-fns-a-b_c-d1.mjs', 'date-fns'],
    ['assets/my-page-x1Y2z3W4.js', 'my-page'],
    ['main.js', 'main'],
  ])('%s -> %s', (file, name) => {
    expect(chunkNameFromFile(file)).toBe(name);
  });
});
