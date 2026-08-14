import { defineConfig } from 'tsdown'

/**
 * The desktop app ships one entry: `lib/main.js` launched by the Electron
 * binary. The root tsdown builds only `lib/types/index.js`, so this override
 * points at `lib/types/main.js`; its reachable host modules bundle with it.
 * `electron` is external — the Electron runtime provides it, and bundling it
 * would duplicate the preload/main-process shim. Declarations come from
 * `tsc -b` (dts: false), matching every package.
 */
export default defineConfig({
  entry: ['lib/types/main.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  external: ['electron'],
  fixedExtension: false,
  dts: false,
  clean: false,
})
