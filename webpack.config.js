const path = require('path');

const isProduction = (process.env.NODE_ENV === 'production');

module.exports = {
  entry: './src/index.js',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isProduction ? 'georaster.bundle.min.js' : 'georaster.bundle.js',
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
};
