'use strict';

// import this library in case you don't use the web worker

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GeoTIFF = require("geotiff");

var parse_data = function parse_data(data) {

    try {

        var result = {
            _arrayBuffer: data.arrayBuffer
        };

        var height = void 0,
            no_data_value = void 0,
            width = void 0;

        if (data.raster_type === "geotiff") {

            //console.log("data.raster_type is geotiff");
            var geotiff = GeoTIFF.parse(data.arrayBuffer);
            //console.log("geotiff:", geotiff);

            var image = geotiff.getImage();

            var fileDirectory = image.fileDirectory;

            result.projection = image.getGeoKeys().GeographicTypeGeoKey;

            result.height = height = image.getHeight();
            result.width = width = image.getWidth();

            // https://www.awaresystems.be/imaging/tiff/tifftags/modeltiepointtag.html
            result.xmin = fileDirectory.ModelTiepoint[3];
            result.ymax = fileDirectory.ModelTiepoint[4];

            // https://www.awaresystems.be/imaging/tiff/tifftags/modelpixelscaletag.html
            result.pixelHeight = fileDirectory.ModelPixelScale[1];
            result.pixelWidth = fileDirectory.ModelPixelScale[0];

            result.xmax = result.xmin + width * result.pixelWidth;
            result.ymin = result.ymax - height * result.pixelHeight;

            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            //console.log("no_data_value:", no_data_value);

            result.number_of_rasters = fileDirectory.SamplesPerPixel;

            result.values = image.readRasters().map(function (values_in_one_dimension) {
                var values_in_two_dimensions = [];
                for (var y = 0; y < height; y++) {
                    var start = y * width;
                    var end = start + width;
                    values_in_two_dimensions.push(values_in_one_dimension.slice(start, end));
                }
                //console.log("values_in_two_dimensions:", values_in_two_dimensions);
                return values_in_two_dimensions;
            });
        }

        result.maxs = [];
        result.mins = [];
        result.ranges = [];

        var max = void 0;var min = void 0;

        //console.log("starting to get min, max and ranges");
        for (var raster_index = 0; raster_index < result.number_of_rasters; raster_index++) {

            var rows = result.values[raster_index];

            for (var row_index = 0; row_index < height; row_index++) {

                var row = rows[row_index];

                for (var column_index = 0; column_index < width; column_index++) {

                    var value = row[column_index];
                    if (value != no_data_value) {
                        if (typeof min === "undefined" || value < min) min = value;else if (typeof max === "undefined" || value > max) max = value;
                    }
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
};

var web_worker_script = "\n\n    // this is a bit of a hack to trick geotiff to work with web worker\n    let window = self;\n\n    let parse_data = " + parse_data.toString() + ";\n    //console.log(\"inside web worker, parse_data is\", parse_data);\n\n    try {\n        /* Need to find a way to do this with webpack */\n        importScripts(\"https://unpkg.com/geotiff@0.4.1/dist/geotiff.browserify.min.js\");\n    } catch (error) {\n        console.error(error);\n    }\n\n    onmessage = e => {\n        //console.error(\"inside worker on message started with\", e); \n        let data = e.data;\n        let result = parse_data(data);\n        console.log(\"posting from web wroker:\", result);\n        postMessage(result, [result._arrayBuffer]);\n        close();\n    }\n";

var GeoRaster = function () {
    function GeoRaster(arrayBuffer) {
        _classCallCheck(this, GeoRaster);

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

    _createClass(GeoRaster, [{
        key: "initialize",
        value: function initialize() {
            var _this = this;

            return new Promise(function (resolve, reject) {
                //console.log("starting GeoRaster.values getter");
                if (_this.raster_type === "geotiff") {
                    if (_this._web_worker_is_available) {
                        var url = void 0;
                        if (_this._blob_is_available) {
                            var blob = new Blob([web_worker_script], { type: 'application/javascript' });
                            //console.log("blob:", blob);
                            if (_this._url_is_available) {
                                url = URL.createObjectURL(blob);
                                //console.log("url:", url);
                            }
                        }
                        var worker = new Worker(url);
                        //console.log("worker:", worker);
                        worker.onmessage = function (e) {
                            console.log("main thread received message:", e);
                            var data = e.data;
                            for (var key in data) {
                                _this[key] = data[key];
                            }
                            resolve(_this);
                        };
                        //console.log("about to postMessage");
                        worker.postMessage({ arrayBuffer: _this._arrayBuffer, raster_type: _this.raster_type }, [_this._arrayBuffer]);
                    } else {
                        //console.log("web worker is not available");
                        var result = parse_data({ arrayBuffer: _this._arrayBuffer, raster_type: _this.raster_type });
                        //console.log("result:", result);
                        resolve(result);
                    }
                } else {
                    reject("couldn't find a way to parse");
                }
            });
        }
    }]);

    return GeoRaster;
}();

module.exports = function (input) {
    return new GeoRaster(input).initialize();
};
