'use strict';

// import this library in case you don't use the web worker
let GeoTIFF = require("geotiff");

let parse_data = (data) => {

    try {

        let result = {};

        let no_data_value;

        if (data.raster_type === "geotiff") {

            //console.log("data.raster_type is geotiff");
            let geotiff = GeoTIFF.parse(data.arrayBuffer);
            //console.log("geotiff:", geotiff);

            let image = geotiff.getImage();

            let fileDirectory = image.fileDirectory;

            result.projection = image.getGeoKeys().GeographicTypeGeoKey;

            result.height = image.getHeight();
            result.width = image.getWidth();

            // https://www.awaresystems.be/imaging/tiff/tifftags/modeltiepointtag.html
            result.xmin = fileDirectory.ModelTiepoint[3];
            result.ymax = fileDirectory.ModelTiepoint[4];

            // https://www.awaresystems.be/imaging/tiff/tifftags/modelpixelscaletag.html
            result.pixelHeight = fileDirectory.ModelPixelScale[1];
            result.pixelWidth = fileDirectory.ModelPixelScale[0];

            result.xmax = result.xmin + result.width * result.pixelWidth;
            result.ymin = result.ymax - result.height * result.pixelHeight;

            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            //console.log("no_data_value:", no_data_value);

            result.number_of_rasters = fileDirectory.SamplesPerPixel;

            result.values = image.readRasters();

        }

        result.maxs = [];
        result.mins = [];
        result.ranges = [];

        let max; let min;

        //console.log("starting to get min, max and ranges");
        for (let r = 0; r < result.number_of_rasters; r++) {

            let values = result.values[r];
            let number_of_values = values.length;

            for (let v = 1; v < number_of_values; v++) {
                let value = values[v];
                if (value != no_data_value) {
                    if (typeof min === "undefined" || value < min) min = value;
                    else if (typeof max === "undefined" || value > max) max = value;
                }
            }
            result.maxs.push(max);
            result.mins.push(min);
            result.ranges.push(max - min);
        }

        return result;

    } catch (error) {

        console.error("error:", error);

    }

}
 

let web_worker_script = `

    // this is a bit of a hack to trick geotiff to work with web worker
    let window = self;

    let parse_data = ${parse_data.toString()};
    //console.log("inside web worker, parse_data is", parse_data);

    try {
        /* Need to find a way to do this with webpack */
        importScripts("https://unpkg.com/geotiff@0.4.1/dist/geotiff.browserify.min.js");
    } catch (error) {
        console.error(error);
    }

    onmessage = e => {
        //console.error("inside worker on message started with", e); 
        let data = e.data;
        let result = parse_data(data);
        postMessage(result);
        close();
    }
`;

class GeoRaster {

    constructor(arrayBuffer) {
        //console.log("starting GeoRaster.constructor with", arrayBuffer.toString());


        if (typeof Buffer !== "undefined" && Buffer.isBuffer(arrayBuffer)) {
            arrayBuffer = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
        }

        this.raster_type = "geotiff";
        this._arrayBuffer = arrayBuffer;
        this._web_worker_is_available = typeof window !== "undefined" && window.Worker !== "undefined";
        this._blob_is_available = typeof Blob !== "undefined";
        this._url_is_available = typeof URL !== "undefined";

        //console.log("this after construction:", this);
    }


    initialize() {
        return new Promise((resolve, reject) => {
            //console.log("starting GeoRaster.values getter");
            if (this.raster_type === "geotiff") {
                if (this._web_worker_is_available) {
                    let url;
                    if (this._blob_is_available) {
                        let blob = new Blob([web_worker_script], {type: 'application/javascript'});
                        //console.log("blob:", blob);
                        if (this._url_is_available) {
                            url = URL.createObjectURL(blob);
                            //console.log("url:", url);
                        }
                    }
                    var worker = new Worker(url);
                    //console.log("worker:", worker);
                    worker.onmessage = (e) => {
                        //console.log("main thread received message:", e);
                        let data = e.data;
                        for (let key in data) {
                            this[key] = data[key];
                        }
                        resolve(this);
                    };
                    //console.log("about to postMessage");
                    worker.postMessage({arrayBuffer: this._arrayBuffer, raster_type: this.raster_type}, [this._arrayBuffer]);
                } else {
                    //console.log("web worker is not available");
                    let result = parse_data({ arrayBuffer: this._arrayBuffer, raster_type: this.raster_type });
                    //console.log("result:", result);
                    resolve(result);
                }
            } else {
                reject("couldn't find a way to parse");
            }
        });
    }

}

module.exports = (input) => new GeoRaster(input).initialize();
