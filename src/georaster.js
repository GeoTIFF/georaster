'use strict';

let GeoTIFF = require("geotiff");

module.exports = class GeoRaster {
    constructor(arrayBuffer) {
        console.log("starting GeoRaster.constructor with", arrayBuffer);
        this.raster_type = "geotiff";
        this.geotiff = GeoTIFF.parse(arrayBuffer);
    }

    get values() {
        if (this.raster_type === "geotiff") {
        
        }
    }
  

}


