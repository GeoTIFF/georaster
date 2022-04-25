import 'cross-fetch/dist/node-polyfill.js';
import { fromArrayBuffer, fromUrl, fromBlob, fromUrls } from 'geotiff';
import { getPalette } from 'geotiff-palette';
import toCanvas from 'georaster-to-canvas';

var WorkerClass = null;

try {
    var WorkerThreads =
        typeof module !== 'undefined' && typeof module.require === 'function' && module.require('worker_threads') ||
        typeof __non_webpack_require__ === 'function' && __non_webpack_require__('worker_threads') ||
        typeof require === 'function' && require('worker_threads');
    WorkerClass = WorkerThreads.Worker;
} catch(e) {} // eslint-disable-line

function decodeBase64(base64, enableUnicode) {
    return Buffer.from(base64, 'base64').toString(enableUnicode ? 'utf16' : 'utf8');
}

function createBase64WorkerFactory(base64, sourcemapArg, enableUnicodeArg) {
    var sourcemap = sourcemapArg === undefined ? null : sourcemapArg;
    var enableUnicode = enableUnicodeArg === undefined ? false : enableUnicodeArg;
    var source = decodeBase64(base64, enableUnicode);
    var start = source.indexOf('\n', 10) + 1;
    var body = source.substring(start) + (sourcemap ? '\/\/# sourceMappingURL=' + sourcemap : '');
    return function WorkerFactory(options) {
        return new WorkerClass(body, Object.assign({}, options, { eval: true }));
    };
}

var WorkerFactory = createBase64WorkerFactory('Lyogcm9sbHVwLXBsdWdpbi13ZWItd29ya2VyLWxvYWRlciAqLwooZnVuY3Rpb24gKGdlb3RpZmYsIGdlb3RpZmZQYWxldHRlKSB7CiAgJ3VzZSBzdHJpY3QnOwoKICAvKgogIFRha2VzIGluIGEgZmxhdHRlbmVkIG9uZSBkaW1lbnNpb25hbCBhcnJheQogIHJlcHJlc2VudGluZyB0d28tZGltZW5zaW9uYWwgcGl4ZWwgdmFsdWVzCiAgYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgYXJyYXlzLgogICovCiAgZnVuY3Rpb24gdW5mbGF0dGVuKHZhbHVlc0luT25lRGltZW5zaW9uLCBzaXplKSB7CiAgICBjb25zdCB7aGVpZ2h0LCB3aWR0aH0gPSBzaXplOwogICAgY29uc3QgdmFsdWVzSW5Ud29EaW1lbnNpb25zID0gW107CiAgICBmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7CiAgICAgIGNvbnN0IHN0YXJ0ID0geSAqIHdpZHRoOwogICAgICBjb25zdCBlbmQgPSBzdGFydCArIHdpZHRoOwogICAgICB2YWx1ZXNJblR3b0RpbWVuc2lvbnMucHVzaCh2YWx1ZXNJbk9uZURpbWVuc2lvbi5zbGljZShzdGFydCwgZW5kKSk7CiAgICB9CiAgICByZXR1cm4gdmFsdWVzSW5Ud29EaW1lbnNpb25zOwogIH0KCiAgZnVuY3Rpb24gcHJvY2Vzc1Jlc3VsdChyZXN1bHQsIGRlYnVnKSB7CiAgICBjb25zdCBub0RhdGFWYWx1ZSA9IHJlc3VsdC5ub0RhdGFWYWx1ZTsKICAgIGNvbnN0IGhlaWdodCA9IHJlc3VsdC5oZWlnaHQ7CiAgICBjb25zdCB3aWR0aCA9IHJlc3VsdC53aWR0aDsKCiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gewogICAgICByZXN1bHQubWF4cyA9IFtdOwogICAgICByZXN1bHQubWlucyA9IFtdOwogICAgICByZXN1bHQucmFuZ2VzID0gW107CgogICAgICBsZXQgbWF4OyBsZXQgbWluOwoKICAgICAgLy8gY29uc29sZS5sb2coInN0YXJ0aW5nIHRvIGdldCBtaW4sIG1heCBhbmQgcmFuZ2VzIik7CiAgICAgIGZvciAobGV0IHJhc3RlckluZGV4ID0gMDsgcmFzdGVySW5kZXggPCByZXN1bHQubnVtYmVyT2ZSYXN0ZXJzOyByYXN0ZXJJbmRleCsrKSB7CiAgICAgICAgY29uc3Qgcm93cyA9IHJlc3VsdC52YWx1ZXNbcmFzdGVySW5kZXhdOwogICAgICAgIGlmIChkZWJ1ZykgY29uc29sZS5sb2coJ1tnZW9yYXN0ZXJdIHJvd3M6Jywgcm93cyk7CgogICAgICAgIGZvciAobGV0IHJvd0luZGV4ID0gMDsgcm93SW5kZXggPCBoZWlnaHQ7IHJvd0luZGV4KyspIHsKICAgICAgICAgIGNvbnN0IHJvdyA9IHJvd3Nbcm93SW5kZXhdOwoKICAgICAgICAgIGZvciAobGV0IGNvbHVtbkluZGV4ID0gMDsgY29sdW1uSW5kZXggPCB3aWR0aDsgY29sdW1uSW5kZXgrKykgewogICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHJvd1tjb2x1bW5JbmRleF07CiAgICAgICAgICAgIGlmICh2YWx1ZSAhPSBub0RhdGFWYWx1ZSAmJiAhaXNOYU4odmFsdWUpKSB7CiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtaW4gPT09ICd1bmRlZmluZWQnIHx8IHZhbHVlIDwgbWluKSBtaW4gPSB2YWx1ZTsKICAgICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgbWF4ID09PSAndW5kZWZpbmVkJyB8fCB2YWx1ZSA+IG1heCkgbWF4ID0gdmFsdWU7CiAgICAgICAgICAgIH0KICAgICAgICAgIH0KICAgICAgICB9CgogICAgICAgIHJlc3VsdC5tYXhzLnB1c2gobWF4KTsKICAgICAgICByZXN1bHQubWlucy5wdXNoKG1pbik7CiAgICAgICAgcmVzdWx0LnJhbmdlcy5wdXNoKG1heCAtIG1pbik7CiAgICAgIH0KCiAgICAgIHJlc29sdmUocmVzdWx0KTsKICAgIH0pOwogIH0KCiAgLyogV2UncmUgbm90IHVzaW5nIGFzeW5jIGJlY2F1c2UgdHJ5aW5nIHRvIGF2b2lkIGRlcGVuZGVuY3kgb24gYmFiZWwncyBwb2x5ZmlsbAogIFRoZXJlIGNhbiBiZSBjb25mbGljdHMgd2hlbiBHZW9SYXN0ZXIgaXMgdXNlZCBpbiBhbm90aGVyIHByb2plY3QgdGhhdCBpcyBhbHNvCiAgdXNpbmcgQGJhYmVsL3BvbHlmaWxsICovCiAgZnVuY3Rpb24gcGFyc2VEYXRhKGRhdGEsIGRlYnVnKSB7CiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gewogICAgICB0cnkgewogICAgICAgIGlmIChkZWJ1ZykgY29uc29sZS5sb2coJ3N0YXJ0aW5nIHBhcnNlRGF0YSB3aXRoJywgZGF0YSk7CiAgICAgICAgaWYgKGRlYnVnKSBjb25zb2xlLmxvZygnXHRHZW9USUZGOicsIHR5cGVvZiBHZW9USUZGKTsKCiAgICAgICAgY29uc3QgcmVzdWx0ID0ge307CgogICAgICAgIGxldCBoZWlnaHQsIHdpZHRoOwoKICAgICAgICBpZiAoZGF0YS5yYXN0ZXJUeXBlID09PSAnb2JqZWN0JykgewogICAgICAgICAgcmVzdWx0LnZhbHVlcyA9IGRhdGEuZGF0YTsKICAgICAgICAgIHJlc3VsdC5oZWlnaHQgPSBoZWlnaHQgPSBkYXRhLm1ldGFkYXRhLmhlaWdodCB8fCByZXN1bHQudmFsdWVzWzBdLmxlbmd0aDsKICAgICAgICAgIHJlc3VsdC53aWR0aCA9IHdpZHRoID0gZGF0YS5tZXRhZGF0YS53aWR0aCB8fCByZXN1bHQudmFsdWVzWzBdWzBdLmxlbmd0aDsKICAgICAgICAgIHJlc3VsdC5waXhlbEhlaWdodCA9IGRhdGEubWV0YWRhdGEucGl4ZWxIZWlnaHQ7CiAgICAgICAgICByZXN1bHQucGl4ZWxXaWR0aCA9IGRhdGEubWV0YWRhdGEucGl4ZWxXaWR0aDsKICAgICAgICAgIHJlc3VsdC5wcm9qZWN0aW9uID0gZGF0YS5tZXRhZGF0YS5wcm9qZWN0aW9uOwogICAgICAgICAgcmVzdWx0LnhtaW4gPSBkYXRhLm1ldGFkYXRhLnhtaW47CiAgICAgICAgICByZXN1bHQueW1heCA9IGRhdGEubWV0YWRhdGEueW1heDsKICAgICAgICAgIHJlc3VsdC5ub0RhdGFWYWx1ZSA9IGRhdGEubWV0YWRhdGEubm9EYXRhVmFsdWU7CiAgICAgICAgICByZXN1bHQubnVtYmVyT2ZSYXN0ZXJzID0gcmVzdWx0LnZhbHVlcy5sZW5ndGg7CiAgICAgICAgICByZXN1bHQueG1heCA9IHJlc3VsdC54bWluICsgcmVzdWx0LndpZHRoICogcmVzdWx0LnBpeGVsV2lkdGg7CiAgICAgICAgICByZXN1bHQueW1pbiA9IHJlc3VsdC55bWF4IC0gcmVzdWx0LmhlaWdodCAqIHJlc3VsdC5waXhlbEhlaWdodDsKICAgICAgICAgIHJlc3VsdC5fZGF0YSA9IG51bGw7CiAgICAgICAgICByZXNvbHZlKHByb2Nlc3NSZXN1bHQocmVzdWx0KSk7CiAgICAgICAgfSBlbHNlIGlmIChkYXRhLnJhc3RlclR5cGUgPT09ICdnZW90aWZmJykgewogICAgICAgICAgcmVzdWx0Ll9kYXRhID0gZGF0YS5kYXRhOwoKICAgICAgICAgIGxldCBpbml0RnVuY3Rpb24gPSBnZW90aWZmLmZyb21BcnJheUJ1ZmZlcjsKICAgICAgICAgIGlmIChkYXRhLnNvdXJjZVR5cGUgPT09ICd1cmwnKSB7CiAgICAgICAgICAgIGluaXRGdW5jdGlvbiA9IGdlb3RpZmYuZnJvbVVybDsKICAgICAgICAgIH0gZWxzZSBpZiAoZGF0YS5zb3VyY2VUeXBlID09PSAnQmxvYicpIHsKICAgICAgICAgICAgaW5pdEZ1bmN0aW9uID0gZ2VvdGlmZi5mcm9tQmxvYjsKICAgICAgICAgIH0KCiAgICAgICAgICBpZiAoZGVidWcpIGNvbnNvbGUubG9nKCdkYXRhLnJhc3RlclR5cGUgaXMgZ2VvdGlmZicpOwogICAgICAgICAgcmVzb2x2ZShpbml0RnVuY3Rpb24oZGF0YS5kYXRhKS50aGVuKGdlb3RpZmYgPT4gewogICAgICAgICAgICBpZiAoZGVidWcpIGNvbnNvbGUubG9nKCdnZW90aWZmOicsIGdlb3RpZmYpOwogICAgICAgICAgICByZXR1cm4gZ2VvdGlmZi5nZXRJbWFnZSgpLnRoZW4oaW1hZ2UgPT4gewogICAgICAgICAgICAgIHRyeSB7CiAgICAgICAgICAgICAgICBpZiAoZGVidWcpIGNvbnNvbGUubG9nKCdpbWFnZTonLCBpbWFnZSk7CgogICAgICAgICAgICAgICAgY29uc3QgZmlsZURpcmVjdG9yeSA9IGltYWdlLmZpbGVEaXJlY3Rvcnk7CgogICAgICAgICAgICAgICAgY29uc3QgewogICAgICAgICAgICAgICAgICBHZW9ncmFwaGljVHlwZUdlb0tleSwKICAgICAgICAgICAgICAgICAgUHJvamVjdGVkQ1NUeXBlR2VvS2V5LAogICAgICAgICAgICAgICAgfSA9IGltYWdlLmdldEdlb0tleXMoKTsKCiAgICAgICAgICAgICAgICByZXN1bHQucHJvamVjdGlvbiA9IFByb2plY3RlZENTVHlwZUdlb0tleSB8fCBHZW9ncmFwaGljVHlwZUdlb0tleTsKICAgICAgICAgICAgICAgIGlmIChkZWJ1ZykgY29uc29sZS5sb2coJ3Byb2plY3Rpb246JywgcmVzdWx0LnByb2plY3Rpb24pOwoKICAgICAgICAgICAgICAgIHJlc3VsdC5oZWlnaHQgPSBoZWlnaHQgPSBpbWFnZS5nZXRIZWlnaHQoKTsKICAgICAgICAgICAgICAgIGlmIChkZWJ1ZykgY29uc29sZS5sb2coJ3Jlc3VsdC5oZWlnaHQ6JywgcmVzdWx0LmhlaWdodCk7CiAgICAgICAgICAgICAgICByZXN1bHQud2lkdGggPSB3aWR0aCA9IGltYWdlLmdldFdpZHRoKCk7CiAgICAgICAgICAgICAgICBpZiAoZGVidWcpIGNvbnNvbGUubG9nKCdyZXN1bHQud2lkdGg6JywgcmVzdWx0LndpZHRoKTsKCiAgICAgICAgICAgICAgICBjb25zdCBbcmVzb2x1dGlvblgsIHJlc29sdXRpb25ZXSA9IGltYWdlLmdldFJlc29sdXRpb24oKTsKICAgICAgICAgICAgICAgIHJlc3VsdC5waXhlbEhlaWdodCA9IE1hdGguYWJzKHJlc29sdXRpb25ZKTsKICAgICAgICAgICAgICAgIHJlc3VsdC5waXhlbFdpZHRoID0gTWF0aC5hYnMocmVzb2x1dGlvblgpOwoKICAgICAgICAgICAgICAgIGNvbnN0IFtvcmlnaW5YLCBvcmlnaW5ZXSA9IGltYWdlLmdldE9yaWdpbigpOwogICAgICAgICAgICAgICAgcmVzdWx0LnhtaW4gPSBvcmlnaW5YOwogICAgICAgICAgICAgICAgcmVzdWx0LnhtYXggPSByZXN1bHQueG1pbiArIHdpZHRoICogcmVzdWx0LnBpeGVsV2lkdGg7CiAgICAgICAgICAgICAgICByZXN1bHQueW1heCA9IG9yaWdpblk7CiAgICAgICAgICAgICAgICByZXN1bHQueW1pbiA9IHJlc3VsdC55bWF4IC0gaGVpZ2h0ICogcmVzdWx0LnBpeGVsSGVpZ2h0OwoKICAgICAgICAgICAgICAgIHJlc3VsdC5ub0RhdGFWYWx1ZSA9IGZpbGVEaXJlY3RvcnkuR0RBTF9OT0RBVEEgPyBwYXJzZUZsb2F0KGZpbGVEaXJlY3RvcnkuR0RBTF9OT0RBVEEpIDogbnVsbDsKCiAgICAgICAgICAgICAgICByZXN1bHQubnVtYmVyT2ZSYXN0ZXJzID0gZmlsZURpcmVjdG9yeS5TYW1wbGVzUGVyUGl4ZWw7CgogICAgICAgICAgICAgICAgaWYgKGZpbGVEaXJlY3RvcnkuQ29sb3JNYXApIHsKICAgICAgICAgICAgICAgICAgcmVzdWx0LnBhbGV0dGUgPSBnZW90aWZmUGFsZXR0ZS5nZXRQYWxldHRlKGltYWdlKTsKICAgICAgICAgICAgICAgIH0KCiAgICAgICAgICAgICAgICBpZiAoZGF0YS5zb3VyY2VUeXBlICE9PSAndXJsJykgewogICAgICAgICAgICAgICAgICByZXR1cm4gaW1hZ2UucmVhZFJhc3RlcnMoKS50aGVuKHJhc3RlcnMgPT4gewogICAgICAgICAgICAgICAgICAgIHJlc3VsdC52YWx1ZXMgPSByYXN0ZXJzLm1hcCh2YWx1ZXNJbk9uZURpbWVuc2lvbiA9PiB7CiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5mbGF0dGVuKHZhbHVlc0luT25lRGltZW5zaW9uLCB7aGVpZ2h0LCB3aWR0aH0pOwogICAgICAgICAgICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9jZXNzUmVzdWx0KHJlc3VsdCk7CiAgICAgICAgICAgICAgICAgIH0pOwogICAgICAgICAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgewogICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTsKICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tnZW9yYXN0ZXJdIGVycm9yIHBhcnNpbmcgZ2VvcmFzdGVyOicsIGVycm9yKTsKICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0pOwogICAgICAgICAgfSkpOwogICAgICAgIH0KICAgICAgfSBjYXRjaCAoZXJyb3IpIHsKICAgICAgICByZWplY3QoZXJyb3IpOwogICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tnZW9yYXN0ZXJdIGVycm9yIHBhcnNpbmcgZ2VvcmFzdGVyOicsIGVycm9yKTsKICAgICAgfQogICAgfSk7CiAgfQoKICBvbm1lc3NhZ2UgPSBlID0+IHsKICAgIGNvbnN0IGRhdGEgPSBlLmRhdGE7CiAgICBwYXJzZURhdGEoZGF0YSkudGhlbihyZXN1bHQgPT4gewogICAgICBpZiAocmVzdWx0Ll9kYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHsKICAgICAgICBwb3N0TWVzc2FnZShyZXN1bHQsIFtyZXN1bHQuX2RhdGFdKTsKICAgICAgfSBlbHNlIHsKICAgICAgICBwb3N0TWVzc2FnZShyZXN1bHQpOwogICAgICB9CiAgICAgIGNsb3NlKCk7CiAgICB9KTsKICB9OwoKfSkoZ2VvdGlmZiwgZ2VvdGlmZlBhbGV0dGUpOwoK', null, false);
/* eslint-enable */

/*
Takes in a flattened one dimensional array
representing two-dimensional pixel values
and returns an array of arrays.
*/
function unflatten(valuesInOneDimension, size) {
  const {height, width} = size;
  const valuesInTwoDimensions = [];
  for (let y = 0; y < height; y++) {
    const start = y * width;
    const end = start + width;
    valuesInTwoDimensions.push(valuesInOneDimension.slice(start, end));
  }
  return valuesInTwoDimensions;
}

function processResult(result, debug) {
  const noDataValue = result.noDataValue;
  const height = result.height;
  const width = result.width;

  return new Promise((resolve, reject) => {
    result.maxs = [];
    result.mins = [];
    result.ranges = [];

    let max; let min;

    // console.log("starting to get min, max and ranges");
    for (let rasterIndex = 0; rasterIndex < result.numberOfRasters; rasterIndex++) {
      const rows = result.values[rasterIndex];
      if (debug) console.log('[georaster] rows:', rows);

      for (let rowIndex = 0; rowIndex < height; rowIndex++) {
        const row = rows[rowIndex];

        for (let columnIndex = 0; columnIndex < width; columnIndex++) {
          const value = row[columnIndex];
          if (value != noDataValue && !isNaN(value)) {
            if (typeof min === 'undefined' || value < min) min = value;
            else if (typeof max === 'undefined' || value > max) max = value;
          }
        }
      }

      result.maxs.push(max);
      result.mins.push(min);
      result.ranges.push(max - min);
    }

    resolve(result);
  });
}

/* We're not using async because trying to avoid dependency on babel's polyfill
There can be conflicts when GeoRaster is used in another project that is also
using @babel/polyfill */
function parseData(data, debug) {
  return new Promise((resolve, reject) => {
    try {
      if (debug) console.log('starting parseData with', data);
      if (debug) console.log('\tGeoTIFF:', typeof GeoTIFF);

      const result = {};

      let height, width;

      if (data.rasterType === 'object') {
        result.values = data.data;
        result.height = height = data.metadata.height || result.values[0].length;
        result.width = width = data.metadata.width || result.values[0][0].length;
        result.pixelHeight = data.metadata.pixelHeight;
        result.pixelWidth = data.metadata.pixelWidth;
        result.projection = data.metadata.projection;
        result.xmin = data.metadata.xmin;
        result.ymax = data.metadata.ymax;
        result.noDataValue = data.metadata.noDataValue;
        result.numberOfRasters = result.values.length;
        result.xmax = result.xmin + result.width * result.pixelWidth;
        result.ymin = result.ymax - result.height * result.pixelHeight;
        result._data = null;
        resolve(processResult(result));
      } else if (data.rasterType === 'geotiff') {
        result._data = data.data;

        let initFunction = fromArrayBuffer;
        if (data.sourceType === 'url') {
          initFunction = fromUrl;
        } else if (data.sourceType === 'Blob') {
          initFunction = fromBlob;
        }

        if (debug) console.log('data.rasterType is geotiff');
        resolve(initFunction(data.data).then(geotiff => {
          if (debug) console.log('geotiff:', geotiff);
          return geotiff.getImage().then(image => {
            try {
              if (debug) console.log('image:', image);

              const fileDirectory = image.fileDirectory;

              const {
                GeographicTypeGeoKey,
                ProjectedCSTypeGeoKey,
              } = image.getGeoKeys();

              result.projection = ProjectedCSTypeGeoKey || GeographicTypeGeoKey;
              if (debug) console.log('projection:', result.projection);

              result.height = height = image.getHeight();
              if (debug) console.log('result.height:', result.height);
              result.width = width = image.getWidth();
              if (debug) console.log('result.width:', result.width);

              const [resolutionX, resolutionY] = image.getResolution();
              result.pixelHeight = Math.abs(resolutionY);
              result.pixelWidth = Math.abs(resolutionX);

              const [originX, originY] = image.getOrigin();
              result.xmin = originX;
              result.xmax = result.xmin + width * result.pixelWidth;
              result.ymax = originY;
              result.ymin = result.ymax - height * result.pixelHeight;

              result.noDataValue = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;

              result.numberOfRasters = fileDirectory.SamplesPerPixel;

              if (fileDirectory.ColorMap) {
                result.palette = getPalette(image);
              }

              if (data.sourceType !== 'url') {
                return image.readRasters().then(rasters => {
                  result.values = rasters.map(valuesInOneDimension => {
                    return unflatten(valuesInOneDimension, {height, width});
                  });
                  return processResult(result);
                });
              } else {
                return result;
              }
            } catch (error) {
              reject(error);
              console.error('[georaster] error parsing georaster:', error);
            }
          });
        }));
      }
    } catch (error) {
      reject(error);
      console.error('[georaster] error parsing georaster:', error);
    }
  });
}

function urlExists(url) {
  try {
    return fetch(url, {method: 'HEAD'})
        .then(response => response.status === 200)
        .catch(error => false);
  } catch (error) {
    return Promise.resolve(false);
  }
}

function getValues(geotiff, options) {
  const {left, top, right, bottom, width, height, resampleMethod} = options;
  // note this.image and this.geotiff both have a readRasters method;
  // they are not the same thing. use this.geotiff for experimental version
  // that reads from best overview
  return geotiff.readRasters({
    window: [left, top, right, bottom],
    width: width,
    height: height,
    resampleMethod: resampleMethod || 'bilinear',
  }).then(rasters => {
    /*
      The result appears to be an array with a width and height property set.
      We only need the values, assuming the user remembers the width and height.
      Ex: [[0,27723,...11025,12924], width: 10, height: 10]
    */
    return rasters.map(raster => unflatten(raster, {height, width}));
  });
}

class GeoRaster {
  constructor(data, metadata, debug) {
    if (debug) console.log('starting GeoRaster.constructor with', data, metadata);

    this._web_worker_is_available = typeof window !== 'undefined' && window.Worker !== 'undefined';
    this._blob_is_available = typeof Blob !== 'undefined';
    this._url_is_available = typeof URL !== 'undefined';

    // check if should convert to buffer
    if (typeof data === 'object' && data.constructor && data.constructor.name === 'Buffer' && Buffer.isBuffer(data) === false) {
      data = new Buffer(data);
    }

    if (typeof data === 'string') {
      if (debug) console.log('data is a url');
      this._data = data;
      this._url = data;
      this.rasterType = 'geotiff';
      this.sourceType = 'url';
    } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      this._data = data;
      this.rasterType = 'geotiff';
      this.sourceType = 'Blob';
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      // this is node
      if (debug) console.log('data is a buffer');
      this._data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      this.rasterType = 'geotiff';
      this.sourceType = 'Buffer';
    } else if (data instanceof ArrayBuffer) {
      // this is browser
      this._data = data;
      this.rasterType = 'geotiff';
      this.sourceType = 'ArrayBuffer';
    } else if (Array.isArray(data) && metadata) {
      this._data = data;
      this.rasterType = 'object';
      this._metadata = metadata;
    }

    if (debug) console.log('this after construction:', this);
  }

  preinitialize(debug) {
    if (debug) console.log('starting preinitialize');
    if (this._url) {
      // initialize these outside worker to avoid weird worker error
      // I don't see how cache option is passed through with fromUrl,
      // though constantinius says it should work: https://github.com/geotiffjs/geotiff.js/issues/61
      const ovrURL = this._url + '.ovr';
      return urlExists(ovrURL).then(ovrExists => {
        if (debug) console.log('overview exists:', ovrExists);
        if (ovrExists) {
          return fromUrls(this._url, [ovrURL], {cache: true, forceXHR: false});
        } else {
          return fromUrl(this._url, {cache: true, forceXHR: false});
        }
      });
    } else {
      // no pre-initialization steps required if not using a Cloud Optimized GeoTIFF
      return Promise.resolve();
    }
  }

  initialize(debug) {
    return this.preinitialize(debug).then(geotiff => {
      return new Promise((resolve, reject) => {
        if (debug) console.log('starting GeoRaster.initialize');
        if (debug) console.log('this', this);

        if (this.rasterType === 'object' || this.rasterType === 'geotiff' || this.rasterType === 'tiff') {
          if (this._web_worker_is_available) {
            const worker = new WorkerFactory();
            worker.onmessage = (e) => {
              if (debug) console.log('main thread received message:', e);
              const data = e.data;
              for (const key in data) {
                this[key] = data[key];
              }
              if (this._url) {
                this._geotiff = geotiff;
                this.getValues = function(options) {
                  return getValues(this._geotiff, options);
                };
              }
              this.toCanvas = function(options) {
                return toCanvas(this, options);
              };
              resolve(this);
            };
            if (debug) console.log('about to postMessage');
            if (this._data instanceof ArrayBuffer) {
              worker.postMessage({
                data: this._data,
                rasterType: this.rasterType,
                sourceType: this.sourceType,
                metadata: this._metadata,
              }, [this._data]);
            } else {
              worker.postMessage({
                data: this._data,
                rasterType: this.rasterType,
                sourceType: this.sourceType,
                metadata: this._metadata,
              });
            }
          } else {
            if (debug) console.log('web worker is not available');
            parseData({
              data: this._data,
              rasterType: this.rasterType,
              sourceType: this.sourceType,
              metadata: this._metadata,
            }, debug).then(result => {
              if (debug) console.log('result:', result);
              if (this._url) {
                result._geotiff = geotiff;
                result.getValues = function(options) {
                  return getValues(this._geotiff, options);
                };
              }
              result.toCanvas = function(options) {
                return toCanvas(this, options);
              };
              resolve(result);
            }).catch(reject);
          }
        } else {
          reject('couldn\'t find a way to parse');
        }
      });
    });
  }
}

const parseGeoraster = (input, metadata, debug) => {
  if (debug) console.log('starting parseGeoraster with ', input, metadata);

  if (input === undefined) {
    const errorMessage = '[Georaster.parseGeoraster] Error. You passed in undefined to parseGeoraster. We can\'t make a raster out of nothing!';
    throw Error(errorMessage);
  }

  return new GeoRaster(input, metadata, debug).initialize(debug);
};

export { parseGeoraster };
//# sourceMappingURL=georaster.mjs.map
