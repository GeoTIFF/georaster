'use strict';
/* global Blob */
/* global URL */

import fetch from 'cross-fetch';
import Worker from './worker.js';
import parseData from './parseData.js';
import {unflatten} from './utils.js';
import {fromUrl, fromUrls} from 'geotiff';
import toCanvas from 'georaster-to-canvas';

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
};


class GeoRaster {
  constructor(data, metadata, debug) {
    if (debug) console.log('starting GeoRaster.constructor with', data, metadata);

    this._web_worker_is_available = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';
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
      this._metadata = metadata;
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
            const worker = new Worker();
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

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = parseGeoraster;
}

/*
    The following code allows you to use GeoRaster without requiring
*/
if (typeof window !== 'undefined') {
  window['parseGeoraster'] = parseGeoraster;
} else if (typeof self !== 'undefined') {
  self['parseGeoraster'] = parseGeoraster; // jshint ignore:line
}
