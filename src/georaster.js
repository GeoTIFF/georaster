'use strict';

let GeoTIFF = require("geotiff");

/*
    It's weird, but we're putting the web worker script text
    in this file, because it'll be hard to figure out how to load
    the text with webpacking.
*/
let web_worker_script = `

    // have to use verion built ourselves bc version on NPM doesn't include web worker stuff
    /*
        need to get string of node module and then add to front of string
    */
    try {
        importScripts("${window.location.origin}/js/geotiff.browserify.min.js");
    } catch (error) {
        console.error(error);
    }

    onmessage = e => {
        console.error("inside worker on message started with", e); 
        let data = e.data;
        let result = {};

        let no_data_value;

        if (data.raster_type === "geotiff") {

            let geotiff = GeoTIFF.parse(data.arrayBuffer);

            let image = geotiff.getImage();

            let fileDirectory = image.fileDirectory;

            result.height = image.getHeight();
            result.width = image.getWidth();

            // https://www.awaresystems.be/imaging/tiff/tifftags/modeltiepointtag.html
            let [i, j, k, x, y, z] = fileDirectory.ModelTiepoint;

            result.xmin = x;
            result.ymax = y;

            // https://www.awaresystems.be/imaging/tiff/tifftags/modelpixelscaletag.html
            let [ScaleX, ScaleY, ScaleZ] = fileDirectory.ModelPixelScale;

            result.pixelHeight = ScaleY;
            result.pixelWidth = ScaleX;

            result.xmax = result.xmin + result.width * result.pixelWidth;
            result.ymin = result.ymax - result.height * result.pixelHeight;

            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            console.log("no_data_value:", no_data_value);

            result.number_of_rasters = fileDirectory.SamplesPerPixel;

            result.values = image.readRasters();

        }

        result.maxs = [];
        result.mins = [];
        result.ranges = [];

        let max; let min;

        console.log("starting to get min, max and ranges");
        for (let r = 0; r < result.number_of_rasters; r++) {

            let values = result.values[r];
            let number_of_values = values.length;

            for (let v = 1; v < number_of_values; v++) {
                let value = values[v];
                if (value != no_data_value) {
                    if (min === undefined || value < min) min = value;
                    else if (max === undefined || value > max) max = value;
                }
            }
            result.maxs.push(max);
            result.mins.push(min);
            result.ranges.push(max - min);
        }
        postMessage(result);
    }
`;

class GeoRaster {

    constructor(arrayBuffer) {
        console.log("starting GeoRaster.constructor with", arrayBuffer);
        this.raster_type = "geotiff";
        this._arrayBuffer = arrayBuffer;
        this._web_worker_is_available = typeof window !== undefined && window.Worker !== undefined;
        this._blob_is_available = typeof Blob !== undefined;
        this._url_is_available = typeof URL !== undefined;

        console.log("this after construction:", this);
    }


    initialize() {
        return new Promise((resolve, reject) => {
            console.log("starting GeoRaster.values getter");
            if (this.raster_type === "geotiff") {
                if (this._web_worker_is_available) {
                    let url;
                    if (this._blob_is_available) {
                        let blob = new Blob([web_worker_script], {type: 'application/javascript'});
                        console.log("blob:", blob);
                        if (this._url_is_available) {
                            url = URL.createObjectURL(blob);
                            console.log("url:", url);
                        }
                    }
                    var worker = new Worker(url);
                    console.log("worker:", worker);
                    worker.onmessage = (e) => {
                        console.log("main thread received message:", e);
                        let data = e.data;
                        for (let key in data) {
                            this[key] = data[key];
                        }
                        resolve(this);
                    };
                    console.log("about to postMessage");
                    worker.postMessage({arrayBuffer: this._arrayBuffer, raster_type: this.raster_type}, [this._arrayBuffer]);
                }
            }
        });
    }

}

module.exports = (input) => new GeoRaster(input).initialize();
