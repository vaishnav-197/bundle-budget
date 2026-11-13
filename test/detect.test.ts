import { describe, expect, it } from 'vitest';
import { InputError } from '../src/errors.js';
import { detectFormat } from '../src/parsers/detect.js';
import { readFixture } from './helpers.js';

describe('detectFormat', () => {
  it('detects webpack stats', () => {
    expect(detectFormat(readFixture('webpack-app', 'stats.json'))).toBe('webpack');
    expect(detectFormat(readFixture('edge', 'empty-webpack.json'))).toBe('webpack');
  });

  it('detects rollup-plugin-visualizer raw data', () => {
    expect(detectFormat(readFixture('vite-app', 'stats.json'))).toBe('vite');
  });

  it('rejects other visualizer data versions', () => {
    expect(() => detectFormat({ version: 1, tree: {}, nodeParts: {}, nodeMetas: {} })).toThrow(
      'unsupported rollup-plugin-visualizer data version 1 (expected 2)',
    );
  });

  it('explains that a Vite manifest is not enough', () => {
    expect(() => detectFormat(readFixture('edge', 'vite-manifest.json'))).toThrow(/Vite build manifest.*raw-data/);
  });

  it('rejects multi-compiler webpack stats', () => {
    expect(() => detectFormat({ children: [{ chunks: [], assets: [] }] })).toThrow(/multi-compiler/);
  });

  it.each([
    ['an unknown object', readFixture('edge', 'unknown-format.json')],
    ['an empty object', {}],
    ['an array', []],
    ['a string', 'stats'],
    ['null', null],
  ])('rejects %s', (_, data) => {
    expect(() => detectFormat(data)).toThrow(InputError);
    expect(() => detectFormat(data)).toThrow(/^unrecognised stats format/);
  });
});
