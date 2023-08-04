'use strict';

let expect = require('chai').expect;
let fs = require('fs');
let parseGeoraster = require(`../dist/${process.env.GEORASTER_TEST_BUNDLE_NAME}`);
let parseMetadata = require('../src/parse_metadata.js');
let parseISO = parseMetadata.parseISO;
let countIn2D = require('../src/utils.js').countIn2D;


describe('Parsing Data Object', function() {
   describe('Parsing Simple Examples', function() {
      it('should create raster correctly', function(done) {
        this.timeout(5000);
        const values = [ [ [0, 1, 2], [0, 0, 0], [2, 1, 1] ] ];
        const noDataValue = 3;
        const projection = 4326;
        const xmin = -40;
        const ymax = 14;
        const pixelWidth = 0.01;
        const pixelHeight = 0.01;
        const metadata = { noDataValue, projection, xmin, ymax, pixelWidth, pixelHeight };
        parseGeoraster(values, metadata).then(georaster => {
            try {
                console.log("georaster:", georaster);
                expect(georaster.numberOfRasters).to.equal(1);
                expect(georaster.projection).to.equal(projection);
                expect(georaster.noDataValue).to.equal(noDataValue);
                expect(georaster.xmin).to.equal(xmin);
                expect(georaster.xmax).to.equal(-39.97);
                expect(georaster.ymin).to.equal(13.97);
                expect(georaster.ymax).to.equal(ymax);
                expect(georaster.pixelHeight).to.equal(georaster.pixelHeight);
                expect(georaster.pixelWidth).to.equal(georaster.pixelWidth);
                expect(JSON.stringify(georaster.values)).to.equal(JSON.stringify(values));
                done();
            } catch (error) {
                console.error("Error parsing from simple object", error);
            }
        });
      });
   }) ;
});

describe('Parsing Rasters', function() {
  describe('Parsing OSGEO Samples', function() {
    it('should parse data/GeogToWGS84GeoKey5.tif', function(done) {
        this.timeout(50000);
        fs.readFile('data/GeogToWGS84GeoKey5.tif', (error, data) => {
            parseGeoraster(data).then(georaster => {
                try {
                    expect(georaster.numberOfRasters).to.equal(1);
                    expect(georaster.projection).to.equal(32767);
                    expect(georaster.values[0]).to.have.lengthOf(georaster.height);
                    expect(georaster.values[0][0]).to.have.lengthOf(georaster.width);
                    done();
                } catch (error) {
                    console.error('error:', error);
                }
            });
        });
    });
  });
});

describe('Checking Error Catching', function() {
  describe('if you pass in undefined', function() {
    it('should throw an error', function() {
        try {
            parseGeoraster(undefined);
        } catch (error) {
            let actual_error_message = error.toString();
            let expected_error_message = 'Error: [Georaster.parseGeoraster] Error. You passed in undefined to parseGeoraster. We can\'t make a raster out of nothing!';
            expect(actual_error_message).to.equal(expected_error_message);
        }
    });
  });
});

describe('Parsing Metadata', function() {
  describe('if you pass in iso xml text', function() {
    it('should parse metadata', function(done) {
        fs.readFile('data/iso.xml', 'utf8', (error, data) => {
            let parsed = parseISO(data);
            expect(parsed.projection).to.equal(4326);
            expect(parsed.xmin).to.equal(10.2822923743907);
            expect(parsed.xmax).to.equal(13.3486486092171);
            expect(parsed.ymin).to.equal(44.418521542726054);
            expect(parsed.ymax).to.equal(47.15260827566466);
            done();
        });
    });
  });
});

// Using tiff created from http://geomap.arpa.veneto.it/geoserver/wcs?crs=EPSG%3A4326&service=WCS&format=GeoTIFF&request=GetCoverage&height=329&width=368&version=1.0.0&BBox=9.679858245722988%2C13.951082737884812%2C44.183855724634675%2C47.38727409375604&Coverage=geonode%3Aatlanteil
describe('Parsing Geonode Files', function() {
  describe('if you pass in tiff from geoserver', function() {
    it('should parse correctly', function(done) {
        fs.readFile('data/geonode_atlanteil.tif', (error, data) => {
            parseGeoraster(data, null, true).then(parsed => {
                expect(parsed.projection).to.equal(4326);
                expect(parsed.xmin).to.equal(10.2822923743907);
                expect(parsed.xmax).to.equal(13.3486486092171);
                expect(parsed.ymin).to.equal(44.418521542726054);
                expect(parsed.ymax).to.equal(47.15260827566466);
                expect(parsed.values.length).to.equal(1);
                expect(parsed.values[0].length).to.equal(329);
                expect(parsed.values[0][0].length).to.equal(368);
                expect(parsed.maxs[0]).to.equal(5.398769378662109);
                expect(parsed.mins[0]).to.equal(0);
                done();
            });
        });
    });
  });
});

describe('Parsing RGB Rasters', function() {
  describe('Parsing RGB Raster', function() {
    it('should parse data/rgb_raster.tif', function(done) {
        this.timeout(50000);
        fs.readFile('data/rgb_raster.tif', (error, data) => {
            parseGeoraster(data).then(first_georaster => {
                try {
                    // console.log("georaster:", first_georaster);
                    expect(first_georaster.numberOfRasters).to.equal(3);
                    expect(first_georaster.projection).to.equal(4326);
                    const expected_height = 3974;
                    const expected_width = 7322;
                    expect(first_georaster.values[0]).to.have.lengthOf(expected_height);
                    expect(first_georaster.values[0][0]).to.have.lengthOf(expected_width);
                    expect(first_georaster.pixelHeight).to.equal(0.0002695191463334987);
                    expect(first_georaster.pixelWidth).to.equal(0.0002695191463334988);
                    expect(first_georaster.xmin).to.equal(-125.57865783690451);
                    expect(first_georaster.noDataValue).to.equal(null);

                    //removing old data
                    delete first_georaster._data;

                    parseGeoraster(first_georaster.values, first_georaster).then(secondary_georaster => {
                        // console.log("secondary_georaster:", secondary_georaster);
                        expect(secondary_georaster.numberOfRasters).to.equal(3);
                        expect(secondary_georaster.height).to.equal(expected_height);
                        done();
                    });
                } catch (error) {
                    console.error('error:', error);
                }
            });
        });
    });
  });
//   describe('Parsing RGB Paletted Raster', function() {
//     it('should parse data/rgb_paletted.tif', function(done) {
//         this.timeout(50000);
//         fs.readFile('data/rgb_paletted.tif', (error, data) => {
//             parseGeoraster(data).then(georaster => {
//                 try {
//                     expect(georaster.palette).to.be.an('array');
//                     expect(georaster.palette).to.have.lengthOf(256);
//                     done();
//                 } catch (error) {
//                     console.error(error);
//                 }
//             });
//         });
//     });
//   });
});

describe('Parsing COG Raster', function() {
  describe('Parsing COG Raster', function() {
    it('should parse landsat-pds initialized with url', function(done) {
        this.timeout(50000);
        const raster_url = "https://storage.googleapis.com/cfo-public/vegetation/California-Vegetation-CanopyBaseHeight-2016-Summer-00010m.tif";
        parseGeoraster(raster_url, null, true).then(georaster => {
            try {
                expect(georaster.numberOfRasters).to.equal(1);
                expect(georaster.projection).to.equal(32610);
                expect(georaster.height).to.equal(103969);
                expect(georaster.width).to.equal(94338);
                expect(georaster.pixelHeight).to.equal(10);
                expect(georaster.pixelWidth).to.equal(10);
                expect(georaster.xmin).to.equal(374310);
                expect(georaster.xmax).to.equal(1317690);
                expect(georaster.ymin).to.equal(3613890);
                expect(georaster.ymax).to.equal(4653580);
                expect(georaster.noDataValue).to.equal(-9999);

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
                    expect(numBands).to.equal(1);
                    expect(numRows).to.equal(10);
                    expect(numColumns).to.equal(10);

                    // checking histogram for first and only band
                    const histogram = countIn2D(values[0]);
                    console.log("hist:", histogram);
                    expect(histogram[0]).to.equal(11);
                    expect(histogram[-7999]).to.equal(1);
                    done();
                });
            } catch (error) {
                console.error('error:', error);
            }
        });
    });
  });
});

describe('Parsing Private COG Raster', function() {
    describe('Parsing Private COG Raster', function() {
      it('should parse maxar wv01 initialized with url and token', function(done) {
          this.timeout(50000);
          const raster_url = "https://api.dev.content.satcloud.us/catalog/collections/wv01/items/10200100D33E5000/assets/collections/dg-archive/assets/browse/10200100D33E5000.browse.tif";
          let requestOps = {
            headers: {
                Authorization: "Bearer eyJhbGciOiJSUzI1NiIsImprdSI6Imh0dHBzOi8vbG9jYWxob3N0OjgwODAvdWFhL3Rva2VuX2tleXMiLCJraWQiOiJ1YWEtand0LWtleS0xIiwidHlwIjoiSldUIn0.eyJqdGkiOiI1M2QwMjI3OWEzZjk0MjliYTUxZTM1NDhkNWE1ZmMxNiIsInN1YiI6IlMxNGFISkNIMXpWcyIsImF1dGhvcml0aWVzIjpbInNjaW0udXNlcmlkcyIsImNhdGFsb2cuYWN0aXZpdHktbW9uaXRvcmluZy53cml0ZSIsInVhYS5yZXNvdXJjZSIsIm9wZW5pZCIsImNhdGFsb2cuZGF0YXByb3ZpZGVyIiwiY2F0YWxvZy5vYmplY3QtZGV0ZWN0aW9uLnByZW1pdW0iXSwic2NvcGUiOlsic2NpbS51c2VyaWRzIiwidWFhLnJlc291cmNlIiwib3BlbmlkIiwiY2F0YWxvZy5kYXRhcHJvdmlkZXIiLCJjYXRhbG9nLmFjdGl2aXR5LW1vbml0b3Jpbmcud3JpdGUiLCJjYXRhbG9nLm9iamVjdC1kZXRlY3Rpb24ucHJlbWl1bSJdLCJjbGllbnRfaWQiOiJTMTRhSEpDSDF6VnMiLCJjaWQiOiJTMTRhSEpDSDF6VnMiLCJhenAiOiJTMTRhSEpDSDF6VnMiLCJncmFudF90eXBlIjoiY2xpZW50X2NyZWRlbnRpYWxzIiwicmV2X3NpZyI6IjExMDY3M2IyIiwiaWF0IjoxNjc3NTEwMTIyLCJleHAiOjE2Nzc1NTMzMjIsImlzcyI6Imh0dHBzOi8vdWFhLXNlcnZlci1hcHBzLnJlZy5zdmMudXMtZWFzdC0xLmRnLWNvbW1lcmNpYWwtc3RhZ2UtMDEuc2F0Y2xvdWQudXMvb2F1dGgvdG9rZW4iLCJ6aWQiOiJ1YWEiLCJhdWQiOlsic2NpbSIsImNhdGFsb2cuYWN0aXZpdHktbW9uaXRvcmluZyIsInVhYSIsIlMxNGFISkNIMXpWcyIsIm9wZW5pZCIsImNhdGFsb2ciLCJjYXRhbG9nLm9iamVjdC1kZXRlY3Rpb24iXX0.arAKLiTSqI20t4i00bnG-zFllAuQ6PLLBrE_Is3QBanWAiICgC1SqYK5dR9FAgGuRiGOH7-9wb0BwV-CuSR_LJ88U1Rb90i74C6KZbc-2xUjk_nQwlmw4Pmnfu6l9MBOLk2TLgSqEDdbghNsFCAh6zJSv-r8Pvh0M1xX7sslM-4sR7FWuEwUocfPgoVF1Heh0g6FIZ7J3vWAv4AUk5iIp3KxMS_LIsyT49gVnSCpmGGYulo8csqvbQ4gTcMcakpuZ0VpbbUdl8vI4qIVGai7UGl6zKOktr04zeE8YbB9AHOYSoqdNv_PxqS3HGVA-C_oSAf5UjALEYkIV4dNZndQlQ"
            },
            redirect: 'follow',
            forceHTTP: true
          }
          parseGeoraster(raster_url, null, true, requestOps).then(georaster => {
              try {
                  expect(georaster.numberOfRasters).to.equal(1);
                  expect(georaster.projection).to.equal(4326);
                  expect(georaster.noDataValue).to.equal(null);
  
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
                      expect(numBands).to.equal(1);
                      expect(numRows).to.equal(10);
                      expect(numColumns).to.equal(10);
  
                      // checking histogram for first and only band
                      const histogram = countIn2D(values[0]);
                      console.log("hist:", histogram);
                      expect(histogram[0]).to.equal(71);
                      done();
                  });
              } catch (error) {
                  console.error('error:', error);
              }
          });
      });
    });
  });
