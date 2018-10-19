'use strict';
/* global Blob */
/* global URL */

import Worker from './worker.js';

import parseData from './parseData.js';

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

    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      if (debug) console.log('data is a buffer');
      this._data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      this.rasterType = 'geotiff';
    } else if (data instanceof ArrayBuffer) {
      this._data = data;
      this.rasterType = 'geotiff';
    } else if (Array.isArray(data) && metadata) {
      this._data = data;
      this.rasterType = 'object';
      this._metadata = metadata;
    }

    if (debug) console.log('this after construction:', this);
  }


  initialize(debug) {
    return new Promise((resolve, reject) => {
      if (debug) console.log('starting GeoRaster.initialize');
      if (debug) console.log('this', this);

      if (this.rasterType === 'object' || this.rasterType === 'geotiff' || this.rasterType === 'tiff') {
        if (this._web_worker_is_available) {
          const worker = new Worker();
          worker.onmessage = (e) => {
            console.log('main thread received message:', e);
            const data = e.data;
            for (const key in data) {
              this[key] = data[key];
            }
            resolve(this);
          };
          if (debug) console.log('about to postMessage');
          if (this._data instanceof ArrayBuffer) {
            worker.postMessage({
              data: this._data,
              rasterType: this.rasterType,
              metadata: this._metadata,
            }, [this._data]);
          } else {
            worker.postMessage({
              data: this._data,
              rasterType: this.rasterType,
              metadata: this._metadata,
            });
          }
        } else {
          if (debug) console.log('web worker is not available');
          parseData({
            data: this._data,
            rasterType: this.rasterType,
            metadata: this._metadata,
          }).then(result => {
            if (debug) console.log('result:', result);
            resolve(result);
          });
        }
      } else {
        reject('couldn\'t find a way to parse');
      }
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
