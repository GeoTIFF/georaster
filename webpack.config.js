const webpack = require('webpack');
const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const ThreadsPlugin = require('threads-plugin');

module.exports = (env, argv) => {

  const {mode, target} = argv;
  const targetFileNamePart = target === 'node' ? '' : '.browser';

  const plugins = [
    new ThreadsPlugin()
  ];
  if (process.env.ANALYZE_GEORASTER_BUNDLE) {
    plugins.push(new BundleAnalyzerPlugin({
      analyzerHost: process.env.ANALYZER_HOST || "127.0.0.1"
    }));
  }

  const externals = {};
  const node = {};

  // neutralize import 'threads/register' in geotiff.js
  node['threads/register'] = 'empty';

  // can't access fs on the web
  if (target === 'web') node['fs'] = 'empty';

  return {
    entry: './src/index.js',
    mode,
    target: target,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: mode === 'production' ? `georaster${targetFileNamePart}.bundle.min.js` : `georaster${targetFileNamePart}.bundle.js`,
      globalObject: 'typeof self !== \'undefined\' ? self : this',
      library: 'GeoRaster',
      libraryTarget: 'umd',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['env'],
            },
          },
        },
        {
          test: /worker\.js$/,
          use: {
            loader: 'worker-loader',
            options: {
              inline: true,
              fallback: false,
            },
          },
        },
        target === "web" && {
          test: path.resolve(__dirname, 'node_modules/node-fetch/browser.js'),
          use: 'null-loader'
        },
        target === "web" && {
          test: path.resolve(__dirname, 'node_modules/tiny-worker/lib/index.js'),
          use: 'null-loader'
        }
      ].filter(Boolean),
    },
    node,
    externals,
    plugins
  };
};
