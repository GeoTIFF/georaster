'use strict';

const test = require("flug");
const fs = require('fs');
let parseGeoraster = require(`../dist/${process.env.GEORASTER_TEST_BUNDLE_NAME}`);
let parseMetadata = require('../src/parse_metadata.js');
let parseISO = parseMetadata.parseISO;
let countIn2D = require('../src/utils.js').countIn2D;


test('should create raster correctly', async ({ eq }) => {
    const values = [ [ [0, 1, 2], [0, 0, 0], [2, 1, 1] ] ];
    const noDataValue = 3;
    const projection = 4326;
    const xmin = -40;
    const ymax = 14;
    const pixelWidth = 0.01;
    const pixelHeight = 0.01;
    const metadata = { noDataValue, projection, xmin, ymax, pixelWidth, pixelHeight };
    const georaster = await parseGeoraster(values, metadata);
    eq(georaster.numberOfRasters, 1);
    eq(georaster.projection, projection);
    eq(georaster.noDataValue,noDataValue);
    eq(georaster.xmin,xmin);
    eq(georaster.xmax,-39.97);
    eq(georaster.ymin,13.97);
    eq(georaster.ymax,ymax);
    eq(georaster.pixelHeight,georaster.pixelHeight);
    eq(georaster.pixelWidth,georaster.pixelWidth);
    eq(JSON.stringify(georaster.values),JSON.stringify(values));
});

test('should parse data/GeogToWGS84GeoKey5.tif', async ({ eq }) => {
    const data = fs.readFileSync('data/GeogToWGS84GeoKey5.tif');
    const georaster = await parseGeoraster(data);
    eq(georaster.numberOfRasters, 1);
    eq(georaster.projection, 32767);
    eq(georaster.values[0].length, georaster.height);
    eq(georaster.values[0][0].length, georaster.width);
});

test('if you pass in undefined, should throw an error', ({ eq }) => {
    let actual_error_message;
    try {
        parseGeoraster(undefined);
    } catch (error) {
        actual_error_message = error.toString();
    }
    eq(actual_error_message, 'Error: [Georaster.parseGeoraster] Error. You passed in undefined to parseGeoraster. We can\'t make a raster out of nothing!');
});

test('should parse iso xml text', ({ eq }) => {
    const data = fs.readFileSync('./data/iso.xml', 'utf8');
    const parsed = parseISO(data);
    eq(parsed.projection, 4326);
    eq(parsed.xmin, 10.2822923743907);
    eq(parsed.xmax, 13.3486486092171);
    eq(parsed.ymin, 44.418521542726054);
    eq(parsed.ymax, 47.15260827566466);
});

// Using tiff created from http://geomap.arpa.veneto.it/geoserver/wcs?crs=EPSG%3A4326&service=WCS&format=GeoTIFF&request=GetCoverage&height=329&width=368&version=1.0.0&BBox=9.679858245722988%2C13.951082737884812%2C44.183855724634675%2C47.38727409375604&Coverage=geonode%3Aatlanteil
test('should parse Geonode File correctly', async ({ eq }) => {
    const data = fs.readFileSync('data/geonode_atlanteil.tif');
    const parsed = await parseGeoraster(data, null, false);
    eq(parsed.projection, 4326);
    eq(parsed.xmin, 10.2822923743907);
    eq(parsed.xmax, 13.3486486092171);
    eq(parsed.ymin, 44.418521542726054);
    eq(parsed.ymax, 47.15260827566466);
    eq(parsed.values.length, 1);
    eq(parsed.values[0].length, 329);
    eq(parsed.values[0][0].length, 368);
    eq(parsed.maxs, [5.398769378662109]);
    eq(parsed.mins, [0]);
});

test('should parse data/rgb_raster.tif', async ({ eq }) => {
    const data = fs.readFileSync('data/rgb_raster.tif');
    const first_georaster = await parseGeoraster(data);
    // console.log("georaster:", first_georaster);
    eq(first_georaster.numberOfRasters, 3);
    eq(first_georaster.projection, 4326);
    const expected_height = 3974;
    const expected_width = 7322;
    eq(first_georaster.values[0].length, expected_height);
    eq(first_georaster.values[0][0].length, expected_width);
    eq(first_georaster.pixelHeight, 0.0002695191463334987);
    eq(first_georaster.pixelWidth, 0.0002695191463334988);
    eq(first_georaster.xmin, -125.57865783690451);
    eq(first_georaster.noDataValue, null);

    //removing old data
    delete first_georaster._data;

    const secondary_georaster = await parseGeoraster(first_georaster.values, first_georaster);
    // console.log("secondary_georaster:", secondary_georaster);
    eq(secondary_georaster.numberOfRasters, 3);
    eq(secondary_georaster.height, expected_height);
});

// Disabled: File Does Not Exist in Repo
// test('should parse data/rgb_paletted.tif', async ({ eq }) => {
//     const data = fs.readFileSync('data/rgb_paletted.tif');
//     const georaster = await parseGeoraster(data);
//     eq(Array.isArray(georaster.palette), true);
//     eq(georaster.palette.length, 256);
// });

test('min/max calculations', async ({ eq }) => {
    const parsed = await parseGeoraster([ [ [3, -3] ], [ [2, -2] ], [ [1, -1] ] ], {});
    eq(parsed.mins, [-3,-2,-1]);
    eq(parsed.maxs, [3, 2, 1]);
    eq(parsed.ranges, [6, 4, 2]);
});

// describe('Parsing COG Raster', function() {
//   describe('Parsing COG Raster', function() {
//     it('should parse landsat-pds initialized with url', function(done) {
//         this.timeout(50000);
//         const raster_url = "https://landsat-pds.s3.amazonaws.com/c1/L8/024/030/LC08_L1TP_024030_20180723_20180731_01_T1/LC08_L1TP_024030_20180723_20180731_01_T1_B1.TIF";
//         parseGeoraster(raster_url, null, true).then(georaster => {
//             try {
//                 expect(georaster.numberOfRasters).to.equal(1);
//                 expect(georaster.projection).to.equal(32616);
//                 expect(georaster.height).to.equal(8031);
//                 expect(georaster.width).to.equal(7921);
//                 expect(georaster.pixelHeight).to.equal(30);
//                 expect(georaster.pixelWidth).to.equal(30);
//                 expect(georaster.xmin).to.equal(189600);
//                 expect(georaster.xmax).to.equal(427230);
//                 expect(georaster.ymin).to.equal(4663170);
//                 expect(georaster.ymax).to.equal(4904100);
//                 expect(georaster.noDataValue).to.equal(null);

//                 const options = {
//                     left: 0,
//                     top: 0,
//                     right: 4000,
//                     bottom: 4000,
//                     width: 10,
//                     height: 10
//                 };
//                 georaster.getValues(options).then(values => {
//                     console.log("values:", values);
//                     console.log("Object.keys(values):", Object.keys(values));

//                     const numBands = values.length;
//                     const numRows = values[0].length;
//                     const numColumns = values[0][0].length;
//                     expect(numBands).to.equal(1);
//                     expect(numRows).to.equal(10);
//                     expect(numColumns).to.equal(10);

//                     // checking histogram for first and only band
//                     const histogram = countIn2D(values[0]);
//                     console.log("hist:", histogram);
//                     expect(histogram[0]).to.equal(39);
//                     expect(histogram[18522]).to.equal(1);
//                     done();
//                 });
//             } catch (error) {
//                 console.error('error:', error);
//             }
//         });
//     });
//   });

test('Parsing COG Raster', async({ eq })  => {
    const raster_url = "https://storage.googleapis.com/cfo-public/vegetation/California-Vegetation-CanopyBaseHeight-2016-Summer-00010m.tif";
    parseGeoraster(raster_url, null, true).then(georaster => {
        try {
            eq(georaster.numberOfRasters, 1);
            eq(georaster.projection, 32610);
            eq(georaster.height, 103969);
            eq(georaster.width, 94338);
            eq(georaster.pixelHeight, 10);
            eq(georaster.pixelWidth, 10);
            eq(georaster.xmin, 374310);
            eq(georaster.xmax, 1317690);
            eq(georaster.ymin, 3613890);
            eq(georaster.ymax, 4653580);
            eq(georaster.noDataValue, -9999);

            const options = {
                left: 0,
                top: 0,
                right: 4000,
                bottom: 4000,
                width: 10,
                height: 10
            };
            georaster.getValues(options).then(values => {
                console.log("values:", values);
                console.log("Object.keys(values):", Object.keys(values));

                const numBands = values.length;
                const numRows = values[0].length;
                const numColumns = values[0][0].length;
                eq(numBands, 1);
                eq(numRows, 10);
                eq(numColumns, 10);

                // checking histogram for first and only band
                const histogram = countIn2D(values[0]);
                console.log("hist:", histogram);
                eq(histogram[0], 11);
                eq(histogram[-7999], 1);
            });
        } catch (error) {
            console.error('error:', error);
        }
    });
});

test('Parsing Private COG Raster', async({ eq }) => {
    const raster_url = "https://api.maxar.com/discovery/v1/collections/wv01/items/10200100D33E5000/assets/collections/dg-archive/assets/browse/10200100D33E5000.browse.tif";
    let requestOps = {
    headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`
    },
    redirect: 'follow',
    forceHTTP: true
    }
    parseGeoraster(raster_url, null, true, requestOps).then(georaster => {
        eq(georaster.numberOfRasters, 1);
        eq(georaster.projection, 4326);
        eq(georaster.noDataValue, null);

        const options = {
            left: 0,
            top: 0,
            right: 4000,
            bottom: 4000,
            width: 10,
            height: 10
        };
        georaster.getValues(options).then(values => {
            const numBands = values.length;
            const numRows = values[0].length;
            const numColumns = values[0][0].length;
            eq(numBands, 1);
            eq(numRows, 10);
            eq(numColumns, 10);
            const histogram = countIn2D(values[0]);
            eq(histogram[0], 71);
        });
    });
});