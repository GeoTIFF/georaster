'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GeoTIFF = require("geotiff");

module.exports = function () {
    function GeoRaster(arrayBuffer) {
        _classCallCheck(this, GeoRaster);

        console.log("starting GeoRaster.constructor with", arrayBuffer);
        this.raster_type = "geotiff";
        this.geotiff = GeoTIFF.parse(arrayBuffer);
    }

    _createClass(GeoRaster, [{
        key: "values",
        get: function get() {
            if (this.raster_type === "geotiff") {}
        }
    }]);

    return GeoRaster;
}();
