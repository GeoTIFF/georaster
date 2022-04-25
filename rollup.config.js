import webWorkerLoader from 'rollup-plugin-web-worker-loader';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
import {terser} from 'rollup-plugin-terser';

const output = (input, file, format, plugins) => ({
  input,
  output: {
    name: 'GeoRaster',
    sourcemap: true,
    format,
    file,
  },
  plugins,
});

export default [
  output('src/index.node.js', 'dist/node/georaster.mjs', 'es', [
    commonjs(),
    webWorkerLoader({
      targetPlatform: 'node',
      inline: true,
    }),
  ]),
  output('src/index.node.js', 'dist/node/georaster.js', 'cjs', [
    commonjs(),
    webWorkerLoader({
      targetPlatform: 'node',
      inline: true,
    }),
  ]),
  output('src/index.js', 'dist/js/georaster.js', 'cjs', [
    commonjs(),
    webWorkerLoader({
      targetPlatform: 'browser',
      inline: true,
    }),
  ]),
  output('src/index.js', 'dist/es/georaster.js', 'es', [
    commonjs(),
    webWorkerLoader({
      targetPlatform: 'browser',
      inline: true,
    }),
  ]),
  output('src/index.js', 'dist/jsbundle/georaster.bundle.js', 'umd', [
    alias({
      entries: [
        { find: 'geotiff', replacement: 'node_modules/geotiff/dist-browser/geotiff.js' }
      ]
    }),
    nodeResolve(),
    commonjs(),
    webWorkerLoader({
      targetPlatform: 'browser',
      inline: true,
    }),
  ]),
  output('src/index.js', 'dist/jsbundle/georaster.bundle.min.js', 'umd', [
    alias({
      entries: [
        { find: 'geotiff', replacement: 'node_modules/geotiff/dist-browser/geotiff.js' }
      ]
    }),
    nodeResolve(),
    commonjs(),
    webWorkerLoader({
      targetPlatform: 'browser',
      inline: true,
    }),
    terser()
  ]),
];

