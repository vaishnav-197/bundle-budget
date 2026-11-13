# bundle-budget

Check the JavaScript and CSS bundle sizes of a Vite or Webpack build against size budgets, and
fail CI when a budget is exceeded.

- Reads the stats your bundler already produces (webpack `--json`, or rollup-plugin-visualizer
  raw data for Vite) to know which chunks exist and which packages ended up in them.
- Measures the real files in your build directory: raw, gzip and brotli sizes.
- Budgets per asset (with patterns for hashed file names), per chunk, and for the whole build.
- Readable table output, or `--json` for scripts.
- No runtime dependencies. No network access.

```
$ bundle-budget check stats.json --dir dist
vite build in dist (5 files)

      Budget              Target                            Size     Limit  Used  Compression
FAIL  chunk index         index                         75.05 KB  70.00 KB  107%  gzip
PASS  chunk Settings      Settings                       7.34 KB  10.00 KB   73%  gzip
PASS  asset assets/*.css  assets/Settings-Bmu520Xm.css     104 B   1.00 KB   10%  gzip
PASS  asset assets/*.css  assets/index-jKOD1Osa.css        140 B   1.00 KB   14%  gzip
PASS  total               4 JS/CSS files                71.63 KB  80.00 KB   90%  brotli

1 of 5 checks over budget.
```

## Install

Requires Node.js 22.12 or later.

bundle-budget is not published to npm. To use it, build it from source and link it:

```sh
git clone https://github.com/vaishnav-197/bundle-budget.git
cd bundle-budget
npm ci
npm run build
npm link
```

`bundle-budget` is then available on your `PATH`. In a project, you can also run it with
`node path/to/bundle-budget/dist/cli.js`.

## Quick start

1. Make your bundler write a stats file (see [Getting a stats file](#getting-a-stats-file)).
2. Add `bundle-budget.config.json` to your project:

   ```json
   {
     "compression": "gzip",
     "budgets": [
       { "asset": "assets/index-*.js", "max": "150 KB" },
       { "asset": "assets/*.css", "max": "20 KB" },
       { "chunk": "Settings", "max": "30 KB" }
     ],
     "total": { "max": "300 KB", "compression": "brotli" }
   }
   ```

3. Build, then check:

   ```sh
   npx vite build
   bundle-budget check stats.json --dir dist
   ```

To run it in CI, add it after the build step. The process exits with code 1 when a budget is
exceeded, which fails the job:

```json
{
  "scripts": {
    "build": "vite build",
    "size": "bundle-budget check stats.json --dir dist"
  }
}
```

## Usage

```
bundle-budget check <stats-file> --dir <build-dir> [options]
```

| Option | Description |
| --- | --- |
| `<stats-file>` | webpack stats JSON, or rollup-plugin-visualizer raw-data JSON. The format is detected automatically. |
| `-d, --dir <path>` | The build output directory. Required. Sizes are measured from these files. |
| `-c, --config <path>` | Config file. Defaults to `bundle-budget.config.json` in the current directory. |
| `--json` | Print the report as JSON instead of a table. |
| `--verbose` | Also list the largest packages in each chunk. |
| `-h, --help` | Show help. |
| `-v, --version` | Show the version number. |

The table uses colours when stdout is a terminal. Set `NO_COLOR` to turn them off.

### What gets measured

Every file in `--dir` is measured, except:

- source maps (`*.map`)
- hidden files and directories, such as Vite's `.vite/`
- the stats file itself, if you write it into the build directory

All file paths in budgets and output are relative to `--dir` and use `/`.

If the stats file lists a file that doesn't exist in `--dir`, the check stops with an error. This
usually means the stats and the build directory come from separate builds.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Every budget passed. |
| `1` | At least one budget was exceeded. |
| `2` | Usage, config or input error, such as an invalid config, an unreadable stats file, or a budget pattern that matched nothing. |

Errors are written to stderr. The report is written to stdout.

## Configuration

`bundle-budget.config.json`:

| Field | Type | Description |
| --- | --- | --- |
| `compression` | `"raw"`, `"gzip"` or `"brotli"` | Default compression for all budgets. Default: `"gzip"`. |
| `budgets` | array | Asset and chunk budgets, described below. |
| `total` | object | A budget for the whole build: `{ "max": "500 KB", "compression": "brotli" }`. `compression` is optional. |

Each entry in `budgets` has exactly one of `asset` or `chunk`, and a `max`:

| Field | Description |
| --- | --- |
| `asset` | A pattern matched against file paths in the build directory, e.g. `"assets/index-*.js"`. Each matching file is checked against `max` on its own. |
| `chunk` | A pattern matched against chunk names, e.g. `"vendor"` or `"*"`. A chunk's size is the sum of its JavaScript files. |
| `max` | The size limit. |
| `compression` | Optional. Overrides the default compression for this budget. |

At least one budget or a `total` is required. Unknown fields are reported as errors, so a typo
can't silently disable a budget. A pattern that matches nothing is also an error.

The `total` budget adds up every `.js`, `.mjs`, `.cjs` and `.css` file in the build. Each file is
compressed on its own, the way it is served.

### Sizes

`max` is a number of bytes, or a string with a unit:

| Unit | Bytes |
| --- | --- |
| `B` | 1 |
| `KB` | 1,000 |
| `MB` | 1,000,000 |
| `KiB` | 1,024 |
| `MiB` | 1,048,576 |

`KB` and `MB` are decimal, the same as the sizes Vite prints after a build. Units are
case-insensitive and the space is optional: `"150 KB"`, `"150kb"` and `"1.2 MB"` are all valid.
The output always uses decimal units.

### Patterns

| Pattern | Matches |
| --- | --- |
| `*` | Any characters except `/` |
| `**` | Any characters, including `/`. `**/` can also match no directory at all. |
| `?` | One character except `/` |

Everything else matches literally. The pattern has to match the whole path:
`"assets/*.js"` matches `assets/index-D1LtzFCC.js` but not `assets/legacy/index.js`.

### Compression

- `raw`: the file size on disk
- `gzip`: gzip at level 9
- `brotli`: brotli at quality 11

These are the levels usually used for precompressed static files. Sizes are computed with
Node's built-in `zlib`.

## Getting a stats file

### Webpack

Use the stats JSON that webpack writes with `--json`:

```sh
npx webpack --mode production --json stats.json
```

bundle-budget reads `assets`, `chunks` and `modules` from it. Chunk names come from
`webpackChunkName` comments and `splitChunks` cache group names. Chunks without a name use their
id. Builds with several compilers (a config that exports an array) are not supported. Write
stats for one compiler at a time.

### Vite

Vite's build manifest (`build.manifest`) doesn't record which modules ended up in which chunk, so
bundle-budget uses the raw data from
[rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer) instead:

```sh
npm install --save-dev rollup-plugin-visualizer
```

```js
// vite.config.js
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [visualizer({ template: 'raw-data', filename: 'stats.json' })],
});
```

`vite build` then writes `stats.json` to your project root. bundle-budget reads raw data
version 2, the format written by rollup-plugin-visualizer 7, and stops with an error on any
other version.

The raw data does not include chunk names, so they are taken from the file names using Vite's
default `[name]-[hash]` pattern: `assets/index-D1LtzFCC.js` becomes the chunk `index`. If you
change `build.rollupOptions.output.chunkFileNames`, use `asset` budgets instead.

## Package breakdown

`--verbose` lists the largest packages in each chunk, based on the modules in the stats file:

```
Chunks (module sizes before minification)

  index (entry)  assets/index-D1LtzFCC.js
    react-dom  536.69 KB
    date-fns    38.42 KB
    react       17.07 KB
    scheduler    9.21 KB
    lodash-es    5.79 KB
    ... and 1 more

  Settings  assets/Settings-Bw2Hwa_q.js
    lodash-es    42.66 KB
    date-fns      6.28 KB
    (app code)      669 B
```

Module sizes come from the bundler and are measured before minification. They show where the
weight of a chunk comes from. Budgets always use the sizes of the real files.

## JSON output

`--json` prints a single object:

```json
{
  "bundler": "vite",
  "passed": false,
  "budgets": [
    {
      "kind": "chunk",
      "budget": "chunk index",
      "target": "index",
      "compression": "gzip",
      "size": 75052,
      "max": 70000,
      "passed": false
    }
  ],
  "assets": [
    { "file": "assets/index-D1LtzFCC.js", "raw": 243524, "gzip": 75052, "brotli": 64710 }
  ],
  "chunks": [
    {
      "name": "index",
      "entry": true,
      "files": ["assets/index-D1LtzFCC.js"],
      "packages": [{ "name": "react-dom", "size": 536687 }]
    }
  ]
}
```

All sizes are in bytes. The example is shortened. The real output has one entry for each check,
asset, chunk and package.

## Development

```sh
npm ci
npm run build      # compile to dist/
npm run typecheck  # type-check src/ and test/
npm test           # unit tests and CLI tests (needs a build first)
```

The test fixtures are real Vite and Webpack builds. [fixtures/README.md](fixtures/README.md)
describes how they were made.

## License

[MIT](LICENSE)
