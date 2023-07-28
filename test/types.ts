// Internal test of Typescript types.  Imports from src not dist.
// downstream TS users of geotiff should simply import the geotiff library and will get types along with the dist build

import { assert } from "console";
import parseGeoraster from "../src";
import { countIn2D } from "../src/utils";

// Floating point number values

const values = [
  [
    [0, 1, 2],
    [0, 0, 0],
    [2, 1, 1]
  ]
];

const noDataValue = 3;
const projection = 4326;
const xmin = 10; // left
const ymax = 13; // top
const pixelWidth = 1;
const pixelHeight = 1;
const metadata = {
  noDataValue,
  projection,
  xmin,
  ymax,
  pixelWidth,
  pixelHeight,
};

parseGeoraster(values, metadata).then(georaster => {
  const values = georaster.values
  console.log('number raster values', values)
  assert(values.length === 1) // single band
  assert(values[0].length === 3)
  values[0].forEach(row => assert(Array.isArray(row)))  // Should be standard javascript Array type
  assert(values[0][0][2] === 2)
});

//// Unsigned 8-bit integer values

const unsignedValues = values.map(band =>
  band.map(row => new Uint8Array(row))
);

parseGeoraster(unsignedValues, metadata).then(georaster => {
  const values = georaster.values
  console.log('unsigned 8-bit int raster values', values)
  assert(values.length === 1) // single band
  assert(values[0].length === 3)
  values[0].forEach(row => assert(typeof row === 'object'))  // Typed arrays in Javascript are not of Array type
  assert(values[0][0][2] === 2) // But they do behave like arrays for read access and return numbers
});

/// COG test

const raster_url = "https://landsat-pds.s3.amazonaws.com/c1/L8/024/030/LC08_L1TP_024030_20180723_20180731_01_T1/LC08_L1TP_024030_20180723_20180731_01_T1_B1.TIF";
parseGeoraster(raster_url).then(georaster => {
  try {
    const options = {
      left: 0,
      top: 0,
      right: 4000,
      bottom: 4000,
      width: 10,
      height: 10
    };
    if (!georaster.getValues) throw new Error('georaster configured without URL')
    georaster.getValues(options).then(values => {
      const numBands = values.length;
      const numRows = values[0].length;
      const numColumns = values[0][0].length;

      // checking histogram for first and only band
      const histogram = countIn2D(values[0]);
      assert(histogram[0] === 39)
    });
  } catch (error) {
      console.error('error:', error);
  }
});