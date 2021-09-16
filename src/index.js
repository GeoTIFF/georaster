"use strict";
/* global Blob */
/* global URL */
/* global self */

// pre-loading
import fixBuffer from "fix-buffer";
import checkParams from "./check-params.js";
import identifyDataType from "./identify-data-type.js";

// loading
import loadAsciiGrid from "./ascii-grid/load-ascii-grid.js";
import loadGeoTIFF from "./geotiff/load-geotiff.js";
import loadJPG from "./jpg/load-jpg.js";
import loadPNG from "./png/load-png.js";
import loadSimpleObject from "./simple-object/load-simple-object.js";

async function parseGeoRaster({ data, debugLevel = 0, stats = true }) {
    if (debugLevel >= 1) console.log("[georaster] starting parseGeoraster with ", arguments);

    checkParams(data);

    // normalize data into an array
    if (!Array.isArray(data)) data = [data];

    // see https://github.com/DanielJDufour/fix-buffer
    data = data.map(fixBuffer);

    const dataType = identifyDataType({ data, debug });
    if (debugLevel >= 1) console.log("[georaster] dataType:", dataType);

    if (["ASCII Grid", "ASCII Grid & PRJ"].includes(dataType)) {
        return loadAsciiGrid({ data, debug, stats });
    } else if (["GeoTIFF", "Cloud Optimized GeoTIFF"].includes(dataType)) {
        return loadGeoTIFF({ data, debug, stats });
    } else if (dataType === "Simple Object") {
        return loadSimpleObject(data, { debug });
    } else if (["Auxiliary XML & PNG & World File", "Auxiliary XML & PNG", "PNG", "PNG & World File"].includes(dataType)) {
        return loadPNG(data, { debug, stats });
    } else if (["Auxiliary XML & JPG & World File", "Auxiliary XML & JPG", "JPG", "JPG & World File"].includes(dataType)) {
        return loadJPG(data, { debug, stats });
    }
}

export default parseGeoRaster;

/*
  The following code allows you to use GeoRaster without requiring
*/
if (typeof window !== "undefined") {
    window["parseGeoraster"] = parseGeoRaster;
    window["parseGeoRaster"] = parseGeoRaster;
} else if (typeof self !== "undefined") {
    self["parseGeoraster"] = parseGeoRaster; // jshint ignore:line
    self["parseGeoRaster"] = parseGeoRaster; // jshint ignore:line
}
