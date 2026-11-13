import { describe, expect, it } from 'vitest';
import { packageName } from '../src/parsers/shared.js';

describe('packageName', () => {
  it.each([
    ['./node_modules/react-dom/client.js', 'react-dom'],
    ['/node_modules/lodash-es/debounce.js', 'lodash-es'],
    ['./node_modules/@babel/runtime/helpers/extends.js', '@babel/runtime'],
    ['/node_modules/.pnpm/react@19.3.1/node_modules/react/index.js', 'react'],
    ['./node_modules/a/node_modules/b/index.js', 'b'],
    ['css ./node_modules/css-loader/dist/cjs.js!./src/styles.css', null],
    ['css ./node_modules/css-loader/dist/cjs.js!./node_modules/normalize.css/normalize.css', 'normalize.css'],
    ['node_modules\\date-fns\\format.js', 'date-fns'],
    ['./src/App.js', null],
    ['webpack/runtime/load script', null],
    ['./node_modules/@scope', null],
  ])('%s -> %s', (id, expected) => {
    expect(packageName(id)).toBe(expected);
  });
});
