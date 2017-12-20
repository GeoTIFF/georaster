'use strict';

let expect = require('chai').expect;
let fs = require("fs");
let parse_georaster = require("../src/georaster.js");

describe('Parsing Rasters', function() {
  describe('Parsing OSGEO Samples', function() {
    it('should parse data/GeogToWGS84GeoKey5.tif', function(done) {
        this.timeout(50000);
        fs.readFile("data/GeogToWGS84GeoKey5.tif", (error, data) => {
            parse_georaster(data).then(georaster => {
                try {
                    expect(georaster.number_of_rasters).to.equal(1);
                    expect(georaster.projection).to.equal(32767);
                    expect(georaster.values[0]).to.have.lengthOf(georaster.height);
                    expect(georaster.values[0][0]).to.have.lengthOf(georaster.width);
                    done();
                } catch (error) {
                    console.error("error:", error);
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
            parse_georaster(undefined);
        } catch (error) {
            let actual_error_message = error.toString();
            let expected_error_message = 'Error: [Georaster.parse_georaster] Error. You passed in undefined to parse_georaster. We can\'t make a raster out of nothing!';
            expect(actual_error_message).to.equal(expected_error_message);
        }
    });
  });
});
