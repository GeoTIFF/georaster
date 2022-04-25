import {fromArrayBuffer, fromUrl, fromBlob} from 'geotiff';
import {getPalette} from 'geotiff-palette';
import {unflatten} from './utils.js';

export function processResult(result, debug) {
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
export default function parseData(data, debug) {
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
