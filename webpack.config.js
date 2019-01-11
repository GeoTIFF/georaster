const path = require('path');

module.exports = (env, argv) => {

  console.log('mode:', argv.mode)

  const { mode } = argv

  return {
    entry: ['babel-polyfill', './src/index.js'],
    mode,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: mode === 'production' ? 'georaster.bundle.min.js' : 'georaster.bundle.js',
      globalObject: 'typeof self !== \'undefined\' ? self : this',
      library: 'GeoRaster',
      libraryTarget: 'umd'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['env']
            }
          }
        },
        {
          test: /worker\.js$/,
          use: {
            loader: 'worker-loader',
            options: {
              inline: true,
              fallback: false
            }
          },
        }
      ]
    },
    node: {
      // prevents this error Module not found: Error: Can't resolve 'fs' in '/home/ubuntu/georaster/node_modules/geotiff/dist'
      fs: "empty"
    }
  }
}
