const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  console.log('mode:', argv.mode);
  console.log('target:', argv.target);
  const {mode, target} = argv;
  const targetFileNamePart = target === 'node' ? '' : '.browser';

  const plugins = []
  if (process.env.ANALYZE_GEORASTER_BUNDLE) {
    plugins.push(BundleAnalyzerPlugin({
      analyzerHost: process.env.ANALYZER_HOST || "127.0.0.1"
    }));
  }
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
      ],
    },
    node: {
      // prevents this error Module not found: Error: Can't resolve 'fs' in '/home/ubuntu/georaster/node_modules/geotiff/dist'
      fs: 'empty',
    },
    externals: {
      // we do this so we can manually polyfill fetch as a global variable,
      // activating geotiff.js' makeFetchSource function when using fromUrl
      'node-fetch': 'node-fetch',
    },
    plugins
  };
};
