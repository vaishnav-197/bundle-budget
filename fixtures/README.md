# Fixtures

## `vite-app/` and `webpack-app/`

Real build output from two small React apps. Both apps contain the same code:

- an entry that renders a React component and imports a CSS file
- `date-fns` and `lodash-es` used from the entry
- a settings page loaded with a dynamic `import()`, which has its own CSS file and uses more of
  `date-fns` and `lodash-es`

The sample apps are not part of this repository. Only their stats files and build output were
copied here.

### Vite

Versions: vite 8.3.5, @vitejs/plugin-react 6.1.2, rollup-plugin-visualizer 7.1.1,
react / react-dom 19.3.1, date-fns 4.4.0, lodash-es 4.18.1.

```js
// vite.config.js
export default defineConfig({
  build: { sourcemap: false },
  plugins: [react(), visualizer({ template: 'raw-data', filename: 'stats.json' })],
});
```

Built with `vite build`. `dist/` is copied as is.

### Webpack

Versions: webpack 5.112.1, webpack-cli 7.2.3, css-loader 7.1.5, mini-css-extract-plugin 2.10.2,
html-webpack-plugin 5.6.8, react / react-dom 19.3.1, date-fns 4.4.0, lodash-es 4.18.1.

The config uses `[name].[contenthash:8]` file names, `devtool: false`, `MiniCssExtractPlugin`
for CSS, `HtmlWebpackPlugin`, and a `vendor` cache group for `node_modules` in initial chunks.
The settings page ends up in a `settings` chunk, plus an unnamed shared chunk (`760`).

Built with `webpack --mode production --json stats.json`. `dist/` is copied as is.

### Post-processing of the stats files

The stats files were reduced in size and made machine-independent:

- Fields that bundle-budget does not read were removed. Webpack: `identifier`,
  `nameForCondition`, `reasons`, `optimizationBailout`, `usedExports`, `providedExports`, the
  `issuer*` fields, module index/depth/cache flags, `chunks[].modules`, `chunks[].origins` and
  `children`. Vite: `imported` and `importedBy` in `nodeMetas`.
- Absolute paths were rewritten relative to the sample app, and `outputPath` was set to `dist`.
- The JSON was written without indentation.

## `edge/`

Hand-written files for error handling:

| File | Purpose |
| --- | --- |
| `malformed.json` | Truncated JSON |
| `unknown-format.json` | Valid JSON that is not a stats file |
| `vite-manifest.json` | A Vite build manifest, which has no module information |
| `empty-webpack.json` | Webpack stats for a build with no assets or chunks |
| `missing-asset/` | Webpack stats listing `js/lazy.js`, which is not in `dist/` |

## `configs/`

Config files used by the CLI tests.
