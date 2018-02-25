'use strict';

// import this library in case you don't use the web worker

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GeoTIFF = require("geotiff");
console.log("GeoTIFF:", typeof GeoTIFF === "undefined" ? "undefined" : _typeof(GeoTIFF));

var utif = require("utif");
console.log("utif:", typeof utif === "undefined" ? "undefined" : _typeof(utif));

var parse_data = function parse_data(data, debug) {

    try {
        debug = true;

        if (debug) console.log("starting parse_data with", data);
        if (debug) console.log("\tGeoTIFF:", typeof GeoTIFF === "undefined" ? "undefined" : _typeof(GeoTIFF));
        if (debug) console.log("\tutif:", typeof utif === "undefined" ? "undefined" : _typeof(utif));

        //console.log("parser:", parser);

        var result = {
            _arrayBuffer: data.arrayBuffer
        };

        var height = void 0,
            no_data_value = void 0,
            width = void 0;

        if (data.raster_type === "geotiff") {

            var parser = typeof GeoTIFF !== "undefined" ? GeoTIFF : typeof window !== "undefined" ? window.GeoTIFF : typeof self !== "undefined" ? self.GeoTIFF : null;

            if (debug) console.log("data.raster_type is geotiff");
            var geotiff = parser.parse(data.arrayBuffer);
            if (debug) console.log("geotiff:", geotiff);

            var image = geotiff.getImage();
            if (debug) console.log("image:", image);

            var fileDirectory = image.fileDirectory;

            var geoKeys = image.getGeoKeys();

            if (debug) console.log("geoKeys:", geoKeys);
            result.projection = geoKeys.GeographicTypeGeoKey;
            if (debug) console.log("projection:", result.projection);

            result.height = height = image.getHeight();
            if (debug) console.log("result.height:", result.height);
            result.width = width = image.getWidth();
            if (debug) console.log("result.width:", result.width);

            var _image$getResolution = image.getResolution(),
                _image$getResolution2 = _slicedToArray(_image$getResolution, 3),
                resolutionX = _image$getResolution2[0],
                resolutionY = _image$getResolution2[1],
                resolutionZ = _image$getResolution2[2];

            var flippedX = resolutionX < 0;
            var flippedY = resolutionY < 0;
            result.pixelHeight = Math.abs(resolutionY);
            result.pixelWidth = Math.abs(resolutionX);

            var _image$getOrigin = image.getOrigin(),
                _image$getOrigin2 = _slicedToArray(_image$getOrigin, 3),
                originX = _image$getOrigin2[0],
                originY = _image$getOrigin2[1],
                originZ = _image$getOrigin2[2];

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
        } else if (data.raster_type === "tiff") {
            console.log("raster type is regular tiff");
            var _parser = typeof utif !== "undefined" ? utif : typeof window !== "undefined" ? window.UTIF : typeof self !== "undefined" ? self.UTIF : null;
            var ifds = _parser.decode(data.arrayBuffer);
            console.log("ifds:", ifds);
            var images = _parser.decodeImages(data.arrayBuffer, ifds);
            console.log("images:", images);
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

        console.error("[georaster] error parsing georaster:", error);
    }
};

var web_worker_script = "\n\n    // this is a bit of a hack to trick geotiff to work with web worker\n    let window = self;\n\n    let parse_data = " + parse_data.toString() + ";\n    //console.log(\"inside web worker, parse_data is\", parse_data);\n\n    try {\n        /* Need to find a way to do this with webpack */\n        importScripts(\"https://unpkg.com/geotiff@0.4.1/dist/geotiff.browserify.min.js\");\n    } catch (error) {\n        console.error(error);\n    }\n\n    onmessage = e => {\n        //console.error(\"inside worker on message started with\", e); \n        let data = e.data;\n        let result = parse_data(data);\n        console.log(\"posting from web wroker:\", result);\n        postMessage(result, [result._arrayBuffer]);\n        close();\n    }\n";

var GeoRaster = function () {
    function GeoRaster(arrayBuffer, metadata, debug) {
        _classCallCheck(this, GeoRaster);

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

    _createClass(GeoRaster, [{
        key: "initialize",
        value: function initialize(debug) {
            var _this = this;

            return new Promise(function (resolve, reject) {
                if (debug) console.log("starting GeoRaster.initialize");
                if (_this.raster_type === "geotiff" || _this.raster_type === "tiff") {
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
                        if (debug) console.log("about to postMessage");
                        worker.postMessage({
                            arrayBuffer: _this._arrayBuffer,
                            raster_type: _this.raster_type,
                            metadata: _this._metadata
                        }, [_this._arrayBuffer]);
                    } else {
                        if (debug) console.log("web worker is not available");
                        var result = parse_data({
                            arrayBuffer: _this._arrayBuffer,
                            raster_type: _this.raster_type,
                            metadata: _this._metadata
                        });
                        if (debug) console.log("result:", result);
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

var parse_georaster = function parse_georaster(input, metadata, debug) {

    if (debug) console.log("starting parse_georaster with ", input, metadata);

    if (input === undefined) {
        var error_message = "[Georaster.parse_georaster] Error. You passed in undefined to parse_georaster. We can't make a raster out of nothing!";
        throw Error(error_message);
    }

    return new GeoRaster(input, metadata, debug).initialize(debug);
};

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
