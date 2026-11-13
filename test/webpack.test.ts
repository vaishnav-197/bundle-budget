import { describe, expect, it } from 'vitest';
import type { Chunk } from '../src/model.js';
import { parseWebpackStats } from '../src/parsers/webpack.js';
import { readFixture } from './helpers.js';

function chunkByName(chunks: Chunk[], name: string): Chunk {
  const chunk = chunks.find((c) => c.name === name);
  if (!chunk) throw new Error(`no chunk named ${name}`);
  return chunk;
}

describe('parseWebpackStats with the sample app', () => {
  const stats = parseWebpackStats(readFixture('webpack-app', 'stats.json'));

  it('reads every chunk with its files', () => {
    expect(stats.bundler).toBe('webpack');
    expect(stats.chunks.map((c) => c.name).sort()).toEqual(['760', 'main', 'settings', 'vendor']);
    expect(chunkByName(stats.chunks, 'main').files).toEqual(['css/main.e5ec08f4.css', 'js/main.d30a747b.js']);
    expect(chunkByName(stats.chunks, 'vendor').files).toEqual(['js/vendor.99cc4b83.js']);
  });

  it('uses the chunk id when a chunk has no name', () => {
    expect(chunkByName(stats.chunks, '760').files).toEqual(['js/760.c1a5d7c9.js']);
  });

  it('marks the entry chunk', () => {
    expect(stats.chunks.filter((c) => c.entry).map((c) => c.name)).toEqual(['main']);
  });

  it('lists every asset in the stats', () => {
    expect([...stats.files].sort()).toEqual([
      'css/main.e5ec08f4.css',
      'css/settings.4da09bda.css',
      'index.html',
      'js/760.c1a5d7c9.js',
      'js/main.d30a747b.js',
      'js/settings.946e0f38.js',
      'js/vendor.99cc4b83.js',
    ]);
  });

  it('assigns node_modules packages to the chunks they ended up in', () => {
    const packages = (name: string) => new Set(chunkByName(stats.chunks, name).modules.map((m) => m.package));
    expect(packages('vendor')).toEqual(new Set(['react', 'react-dom', 'scheduler', 'date-fns', 'lodash-es']));
    expect(packages('760')).toEqual(new Set(['date-fns', 'lodash-es']));
    expect(packages('main')).toEqual(new Set([null]));
  });

  it('expands concatenated modules into the modules they contain', () => {
    const ids = chunkByName(stats.chunks, 'main').modules.map((m) => m.id);
    expect(ids).toContain('./src/index.js');
    expect(ids).toContain('./src/App.js');
    expect(ids.some((id) => id.includes(' + '))).toBe(false);
  });

  it('keeps module sizes', () => {
    const vendor = chunkByName(stats.chunks, 'vendor');
    const reactIndex = vendor.modules.find((m) => m.id === './node_modules/react/index.js');
    expect(reactIndex?.size).toBe(186);
  });
});

describe('parseWebpackStats with hand-written stats', () => {
  it('uses chunk.modules when the stats include them', () => {
    const stats = parseWebpackStats({
      assets: [{ name: 'a.js' }],
      chunks: [
        {
          id: 1,
          names: ['a'],
          files: ['a.js'],
          entry: true,
          modules: [
            { name: './node_modules/@scope/pkg/index.js', size: 10 },
            { name: './src/a.js + 1 modules', size: 30, modules: [{ name: './src/a.js', size: 20 }, { name: './src/b.js', size: 10 }] },
          ],
        },
      ],
      modules: [{ name: './src/ignored.js', size: 99, chunks: [1] }],
    });
    expect(stats.chunks[0]?.modules).toEqual([
      { id: './node_modules/@scope/pkg/index.js', package: '@scope/pkg', size: 10 },
      { id: './src/a.js', package: null, size: 20 },
      { id: './src/b.js', package: null, size: 10 },
    ]);
  });

  it('ignores modules that belong to no chunk', () => {
    const stats = parseWebpackStats({
      assets: [{ name: 'a.js' }],
      chunks: [{ id: 'a', names: [], files: ['a.js'] }],
      modules: [
        { name: './src/a.js', size: 5, chunks: ['a'] },
        { name: './src/orphan.js', size: 5, chunks: [], orphan: true },
      ],
    });
    expect(stats.chunks[0]?.modules.map((m) => m.id)).toEqual(['./src/a.js']);
    expect(stats.chunks[0]?.name).toBe('a');
  });

  it('reads an empty build', () => {
    expect(parseWebpackStats(readFixture('edge', 'empty-webpack.json'))).toEqual({ bundler: 'webpack', chunks: [], files: [] });
  });

  it.each([
    ['missing arrays', { chunks: [] }, 'webpack stats: expected "chunks" and "assets" arrays'],
    ['an asset without a name', { assets: [{ size: 1 }], chunks: [] }, 'webpack stats: assets[0].name is missing'],
    ['a chunk that is not an object', { assets: [], chunks: [5] }, 'webpack stats: chunks[0] is not an object'],
    ['a chunk without an id', { assets: [], chunks: [{ files: [] }] }, 'webpack stats: chunks[0].id is missing'],
    ['a chunk with bad files', { assets: [], chunks: [{ id: 1, files: 'a.js' }] }, 'webpack stats: chunks[0].files must be an array of strings'],
  ])('rejects %s', (_, data, message) => {
    expect(() => parseWebpackStats(data)).toThrow(message);
  });
});
