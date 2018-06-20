'use strict';

// import this library in case you don't use the web worker
let GeoTIFF = require("geotiff");

{~{ precompiled/data/parse_data.js }~}

let web_worker_script = `

    // this is a bit of a hack to trick geotiff to work with web worker
    let window = self;

    {~{ node_modules/geotiff/dist/geotiff.browserify.min.js }~}

    {~{ precompiled/data/parse_data.js }~}


    onmessage = e => {
        //console.error("inside worker on message started with", e); 
        let data = e.data;
        let result = parse_data(data);
        console.log("posting from web wroker:", result);
        if (result._data instanceof ArrayBuffer) {
            postMessage(result, [result._data]);
        } else {
            postMessage(result);
        }
        close();
    }
`;

class GeoRaster {

    constructor(data, metadata, debug) {
        
        if (debug) console.log("starting GeoRaster.constructor with", data, metadata);

        this._web_worker_is_available = typeof window !== "undefined" && window.Worker !== "undefined";
        this._blob_is_available = typeof Blob !== "undefined";
        this._url_is_available = typeof URL !== "undefined";

        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            this._data = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            this.raster_type = "geotiff";
        } else if (data instanceof ArrayBuffer) {
            this._data = data;
            this.raster_type = "geotiff";
        } else if (Array.isArray(data) && metadata) {
            this._data = data;
            this.raster_type = "object";
            this._metadata = metadata;
        }
        
        if (debug) console.log("this after construction:", this);
    }


    initialize(debug) {
        return new Promise((resolve, reject) => {
            if (debug) console.log("starting GeoRaster.initialize");
            if (this.raster_type === "object" || this.raster_type === "geotiff" || this.raster_type === "tiff") {
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
                    if (this._data instanceof ArrayBuffer) {
                        worker.postMessage({
                            data: this._data,
                            raster_type: this.raster_type,
                            metadata: this._metadata
                        }, [this._data]);
                    } else {
                        worker.postMessage({
                            data: this._data,
                            raster_type: this.raster_type,
                            metadata: this._metadata
                        });
                    }
                } else {
                    if (debug) console.log("web worker is not available");
                    let result = parse_data({
                        data: this._data,
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
