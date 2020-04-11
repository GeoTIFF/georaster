const webpack = require('webpack');
const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const ThreadsPlugin = require('threads-plugin');

module.exports = (env, argv) => {

  const {mode, target} = argv;
  const targetFileNamePart = target === 'node' ? '' : '.browser';

  const plugins = [
    new webpack.ProvidePlugin({
      'txml': 'txml'
    }),
    new ThreadsPlugin()
  ];
  if (process.env.ANALYZE_GEORASTER_BUNDLE) {
    plugins.push(new BundleAnalyzerPlugin({
      analyzerHost: process.env.ANALYZER_HOST || "127.0.0.1"
    }));
  }

  const externals = {
    'fs': 'fs'
  };
  // because don't want node-fetch in bundle meant for web
  if (target === 'web') externals['node-fetch'] = 'node-fetch';
  // because threads can look for this
  if (target === 'node') externals['tiny-worker'] = 'tiny-worker';
  externals['txml'] = 'txml';

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
    resolve: {
      alias: {
        'txml': path.resolve(__dirname, './node_modules/txml/tXml.min.js')
      }
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
      ],
    },
    node,
    externals,
    plugins
  };
};
