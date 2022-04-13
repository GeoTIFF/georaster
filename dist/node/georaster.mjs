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

function createURLWorkerFactory(url) {
    return function WorkerFactory(options) {
        return new WorkerClass(url, options);
    };
}

var WorkerFactory = createURLWorkerFactory('web-worker-0.js');
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
