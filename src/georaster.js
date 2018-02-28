'use strict';

// import this library in case you don't use the web worker
let GeoTIFF = require("geotiff");

let parse_data = (data, debug) => {

    try {
        debug = true;

        if (debug) console.log("starting parse_data with", data);
        if (debug) console.log("\tGeoTIFF:", typeof GeoTIFF);


        //console.log("parser:", parser);

        let result = {
            _arrayBuffer: data.arrayBuffer
        };

        let height, no_data_value, width;

        if (data.raster_type === "geotiff") {
            
            let parser = typeof GeoTIFF !== "undefined" ? GeoTIFF : typeof window !== "undefined" ? window.GeoTIFF : typeof self !== "undefined" ? self.GeoTIFF : null;

            if (debug) console.log("data.raster_type is geotiff");
            let geotiff = parser.parse(data.arrayBuffer);
            if (debug) console.log("geotiff:", geotiff);

            let image = geotiff.getImage();
            if (debug) console.log("image:", image);

            let fileDirectory = image.fileDirectory;

            let geoKeys = image.getGeoKeys();

            if (debug) console.log("geoKeys:", geoKeys);
            result.projection = geoKeys.GeographicTypeGeoKey;
            if (debug) console.log("projection:", result.projection);

            result.height = height = image.getHeight();
            if (debug) console.log("result.height:", result.height);
            result.width = width = image.getWidth();
            if (debug) console.log("result.width:", result.width);            

            let [resolutionX, resolutionY, resolutionZ] = image.getResolution();
            let flippedX = resolutionX < 0
            let flippedY = resolutionY < 0;
            result.pixelHeight = Math.abs(resolutionY);
            result.pixelWidth = Math.abs(resolutionX);

            let [originX, originY, originZ ] = image.getOrigin();
            if (flippedX) {
                result.xmax = originX;
                result.xmin = result.xmax - width * result.pixelWidth;
            } else {
                result.xmin = originX;
                result.xmax = result.xmin + width * result.pixelWidth;                
            }
            
            if (flippedY) {
                result.ymin = originY;
                result.ymax = result.ymin + height * result.pixelHeight;
            } else {
                result.ymax = originY;
                result.ymin = result.ymax - height * result.pixelHeight;                
            }

            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            //console.log("no_data_value:", no_data_value);

            result.number_of_rasters = fileDirectory.SamplesPerPixel;

            result.values = image.readRasters().map(values_in_one_dimension => {
                let values_in_two_dimensions = [];
                for (let y = 0; y < height; y++) {
                    let start = y * width;
                    let end = start + width;
                    values_in_two_dimensions.push(values_in_one_dimension.slice(start, end));
                }
                return values_in_two_dimensions;
            });
        }

        result.maxs = [];
        result.mins = [];
        result.ranges = [];

        let max; let min;

        //console.log("starting to get min, max and ranges");
        for (let raster_index = 0; raster_index < result.number_of_rasters; raster_index++) {

            let rows = result.values[raster_index];

            for (let row_index = 0; row_index < height; row_index++) {

                let row = rows[row_index];

                for (let column_index = 0; column_index < width; column_index++) {

                    let value = row[column_index];
                    if (value != no_data_value) {
                        if (typeof min === "undefined" || value < min) min = value;
                        else if (typeof max === "undefined" || value > max) max = value;
                    }
                }
            }

            result.maxs.push(max);
            result.mins.push(min);
            result.ranges.push(max - min);
        }

        return result;

    } catch (error) {

        console.error("[georaster] error parsing georaster:", error);

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
        console.log("posting from web wroker:", result);
        postMessage(result, [result._arrayBuffer]);
        close();
    }
`;

class GeoRaster {

    constructor(arrayBuffer, metadata, debug) {
        
        if (debug) console.log("starting GeoRaster.constructor with", arrayBuffer, metadata);

        if (typeof Buffer !== "undefined" && Buffer.isBuffer(arrayBuffer)) {
            arrayBuffer = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
        }

        this._arrayBuffer = arrayBuffer;
        this._web_worker_is_available = typeof window !== "undefined" && window.Worker !== "undefined";
        this._blob_is_available = typeof Blob !== "undefined";
        this._url_is_available = typeof URL !== "undefined";

        if (metadata) {
            this.raster_type = "tiff";
            this._metadata = metadata;
        } else {
            this.raster_type = "geotiff";
        }

        if (debug) console.log("this after construction:", this);
    }


    initialize(debug) {
        return new Promise((resolve, reject) => {
            if (debug) console.log("starting GeoRaster.initialize");
            if (this.raster_type === "geotiff" || this.raster_type === "tiff") {
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
                        console.log("main thread received message:", e);
                        let data = e.data;
                        for (let key in data) {
                            this[key] = data[key];
                        }
                        resolve(this);
                    };
                    if (debug) console.log("about to postMessage");
                    worker.postMessage({
                        arrayBuffer: this._arrayBuffer,
                        raster_type: this.raster_type,
                        metadata: this._metadata
                    }, [this._arrayBuffer]);
                } else {
                    if (debug) console.log("web worker is not available");
                    let result = parse_data({
                        arrayBuffer: this._arrayBuffer,
                        raster_type: this.raster_type,
                        metadata: this._metadata
                    });
                    if (debug) console.log("result:", result);
                    resolve(result);
                }
            } else {
                reject("couldn't find a way to parse");
            }
        });
    }

}

var parse_georaster = (input, metadata, debug) => {

    if (debug) console.log("starting parse_georaster with ", input, metadata);

    if (input === undefined) {
        let error_message = "[Georaster.parse_georaster] Error. You passed in undefined to parse_georaster. We can't make a raster out of nothing!";
        throw Error(error_message);
    }

    return new GeoRaster(input, metadata, debug).initialize(debug);
}

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports = parse_georaster;
}

/*
    The following code allows you to use GeoRaster without requiring
*/
if (typeof window !== "undefined") {
    window["parse_georaster"] = parse_georaster;
} else if (typeof self !== "undefined") {
    self["parse_georaster"] = parse_georaster; // jshint ignore:line
}
