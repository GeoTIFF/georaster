import parseAsciiGridMeta from "ascii-grid/src/parse-ascii-grid-meta.js";
import calcAsciiGridStats from "ascii-grid/src/calc-ascii-grid-stats.js";

export default function parseMetaAndCalcStats({ data, debugLevel = 0, calcStats = true }) {
    try {
        if (debugLevel >= 1) console.log("[georaster.parseMetaAndCalcStats] starting");

        const meta = parseAsciiGridMeta({ data, debug: false });
        if (debugLevel >= 2) console.log("[georaster.parseMetaAndCalcStats] meta:", meta);

        const result = {
            _asc: data,
            height: meta.nrows,
            noDataValue: meta.nodata_value,
            pixelHeight: meta.cellsize,
            pixelWidth: meta.cellsize,
            width: meta.ncols
        };

        if ("xllcenter" in meta) {
            result.xmin = meta.xllcenter - meta.cellsize / 2;
        } else if ("xllcorner" in meta) {
            result.xmin = meta.xllcorner;
        }
        result.xmax = result.xmin + meta.ncols * meta.cellsize;

        if ("yllcenter" in meta) {
            result.ymin = meta.yllcenter - meta.cellsize / 2;
        } else if ("yllcorner" in meta) {
            result.ymin = meta.yllcorner;
        }
        result.ymax = result.ymin + meta.nrows * meta.cellsize;

        if (calcStats) {
            if (debugLevel >= 1) console.log("[georaster] calculating statistics for ASCII Grid");
            result.stats = [calcAsciiGridStats({ data, calcHistogram: false })];
        }

        if (debugLevel >= 2) console.log("[georaster] parse-ascii-grid.js returning", result);

        return result;
    } catch (error) {
        console.log(error);
        console.error(error);
        throw error;
    }
}
