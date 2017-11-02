'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var web_worker_script = "\n\n    // this is a bit of a hack to trick geotiff to work with web worker\n    window = self;\n\n    try {\n        /* Need to find a way to do this with webpack */\n        importScripts(\"https://unpkg.com/geotiff@0.4.1/dist/geotiff.browserify.min.js\");\n    } catch (error) {\n        console.error(error);\n    }\n\n    onmessage = e => {\n        console.error(\"inside worker on message started with\", e); \n        let data = e.data;\n        let result = {};\n\n        let no_data_value;\n\n        if (data.raster_type === \"geotiff\") {\n\n            let geotiff = GeoTIFF.parse(data.arrayBuffer);\n\n            let image = geotiff.getImage();\n\n            let fileDirectory = image.fileDirectory;\n\n            result.height = image.getHeight();\n            result.width = image.getWidth();\n\n            // https://www.awaresystems.be/imaging/tiff/tifftags/modeltiepointtag.html\n            let [i, j, k, x, y, z] = fileDirectory.ModelTiepoint;\n\n            result.xmin = x;\n            result.ymax = y;\n\n            // https://www.awaresystems.be/imaging/tiff/tifftags/modelpixelscaletag.html\n            let [ScaleX, ScaleY, ScaleZ] = fileDirectory.ModelPixelScale;\n\n            result.pixelHeight = ScaleY;\n            result.pixelWidth = ScaleX;\n\n            result.xmax = result.xmin + result.width * result.pixelWidth;\n            result.ymin = result.ymax - result.height * result.pixelHeight;\n\n            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;\n            console.log(\"no_data_value:\", no_data_value);\n\n            result.number_of_rasters = fileDirectory.SamplesPerPixel;\n\n            result.values = image.readRasters();\n\n        }\n\n        result.maxs = [];\n        result.mins = [];\n        result.ranges = [];\n\n        let max; let min;\n\n        console.log(\"starting to get min, max and ranges\");\n        for (let r = 0; r < result.number_of_rasters; r++) {\n\n            let values = result.values[r];\n            let number_of_values = values.length;\n\n            for (let v = 1; v < number_of_values; v++) {\n                let value = values[v];\n                if (value != no_data_value) {\n                    if (min === undefined || value < min) min = value;\n                    else if (max === undefined || value > max) max = value;\n                }\n            }\n            result.maxs.push(max);\n            result.mins.push(min);\n            result.ranges.push(max - min);\n        }\n        postMessage(result);\n    }\n";

var GeoRaster = function () {
    function GeoRaster(arrayBuffer) {
        _classCallCheck(this, GeoRaster);

        console.log("starting GeoRaster.constructor with", arrayBuffer);
        this.raster_type = "geotiff";
        this._arrayBuffer = arrayBuffer;
        this._web_worker_is_available = (typeof window === "undefined" ? "undefined" : _typeof(window)) !== undefined && window.Worker !== undefined;
        this._blob_is_available = (typeof Blob === "undefined" ? "undefined" : _typeof(Blob)) !== undefined;
        this._url_is_available = (typeof URL === "undefined" ? "undefined" : _typeof(URL)) !== undefined;

        console.log("this after construction:", this);
    }

    _createClass(GeoRaster, [{
        key: "initialize",
        value: function initialize() {
            var _this = this;

            return new Promise(function (resolve, reject) {
                console.log("starting GeoRaster.values getter");
                if (_this.raster_type === "geotiff") {
                    if (_this._web_worker_is_available) {
                        var url = void 0;
                        if (_this._blob_is_available) {
                            var blob = new Blob([web_worker_script], { type: 'application/javascript' });
                            console.log("blob:", blob);
                            if (_this._url_is_available) {
                                url = URL.createObjectURL(blob);
                                console.log("url:", url);
                            }
                        }
                        var worker = new Worker(url);
                        console.log("worker:", worker);
                        worker.onmessage = function (e) {
                            console.log("main thread received message:", e);
                            var data = e.data;
                            for (var key in data) {
                                _this[key] = data[key];
                            }
                            resolve(_this);
                        };
                        console.log("about to postMessage");
                        worker.postMessage({ arrayBuffer: _this._arrayBuffer, raster_type: _this.raster_type }, [_this._arrayBuffer]);
                    }
                }
            });
        }
    }]);

    return GeoRaster;
}();

module.exports = function (input) {
    return new GeoRaster(input).initialize();
};
