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
                    expect(georaster.values[0]).to.have.lengthOf(10201);
                    done();
                } catch (error) {
                    console.error("error:", error);
                }
            });
        });
    });
  });
});
