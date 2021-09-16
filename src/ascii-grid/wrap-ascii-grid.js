import { isAsciiGrid, parseAsciiGridData } from "ascii-grid";
import isPRJ from "is-prj";
import fetchIf from "fetch-if";
import getEPSGCode from "get-epsg-code";
import toTextString from "to-text-string";
import { Worker } from "universal-worker";
import { runOnlyOnce } from "worker-fns";
import geowarp from "geowarp";
import xdim from "xdim";
import addLegacyFields from "../add-legacy-fields";

const isNum = n => typeof n === "number";

export default async function wrapAsciiGrid({ data, debugLevel = 0, calcStats = true }) {
    try {
        if (debugLevel >= 1) console.log("starting loadAsciiGrid");
        if (debugLevel >= 2) console.log("[georaster] data:", data);

        // pre-process data
        if (data instanceof Promise) data = await data;
        if (!Array.isArray(data)) data = [data];

        // fetch files if data points to urls
        // Ascii Grid is not cloud optimized,
        // so have to fetch the whole thing
        const exts = [".asc", ".prj"];
        const condition = it => typeof it === "string" && it.startsWith("http") && exts.some(ext => it.toLowerCase().endsWith(ext));
        const files = await fetchIf({ debug: debugLevel >= 2, items: data, condition });

        const asciiGridFile = files.find(isAsciiGrid);

        const worker = new Worker("./parse-meta-and-calc-stats.js");
        console.log("worker:", Worker);
        console.log("starting runOnlyOnce with asciiGridFile:", asciiGridFile);
        const result = await runOnlyOnce(worker, { data: asciiGridFile, debugLevel, calcStats });
        console.log("got result._asc", result._asc);

        // get epsg code and wkt from .prj file
        const prj = files.find(file => file.byteLength > 0 && isPRJ({ data: file }).result);
        if (prj) {
            if (debugLevel >= 1) console.log("[georaster] found .prj file:", prj);
            result._prj = prj;
            const wkt = toTextString(prj);
            const epsg_code = getEPSGCode(wkt);
            if (debugLevel >= 1) console.log("[georaster] got epsg code " + epsg_code);
            result.srs = {
                code: epsg_code,
                wkt
            };
        } else {
            console.warn("[georaster] no projection information found");
        }

        addLegacyFields(result);
        
        result.getValues = ({
            debug_level = 0,
            width,
            height,
            top = 0,
            left = 0,
            bottom = 0,
            right = 0,
            method = "median",
            round = false,
            theoretical_min,
            theoretical_max,
            layout = "[band][row][column]" // layout in xdim format, alternatives are [band][row,column] or [row,column,band]
        } = {}) => {
            const actual_height = result.height - top - bottom;
            const actual_width = result.width - left - right;
      
            const useGeoWarp = (height !== undefined && height !== null && height !== actual_height) || (width !== undefined && width !== null && width !== actual_width);      
            
            const flat = layout.includes("row,column");

            const start_column = left;
            const end_column = result.width - (right || 0);
            const start_row = top;
            const bottom_row = result.height - (bottom || 0);

            let { values } = parseAsciiGridData({
                assume_clean: true,
                cache: true,
                debug_level: debugLevel - 1,
                data: result._asc,
                flat,
                max_read_length: Infinity,
                meta: result._meta,
                start_column,
                end_column,
                start_row,
                bottom_row
            });

            let current_layout = flat ? "[row,column]" : "[row][column]";
            let current_width = end_column - start_column;
            let current_height = bottom_row - start_row;

            // data is single-banded
            values = [values];
            current_layout = "[band]" + current_layout;

            if (useGeoWarp) {
                if (debug_level >= 1) console.log("[georaster] using geowarp");
                const xmin = result.xmin + (left || 0) * result.pixelWidth;
                const ymin = result.ymin + (bottom || 0) * result.pixelHeight;
                const xmax = result.xmax - (right || 0) * result.pixelWidth;
                const ymax = result.ymax - (top || 0) * result.pixelHeight;
                const bbox = [xmin, ymin, xmax, ymax];
                if (debug_level >= 1) console.log("[georaster] bbox:", bbox);

                const out_height = isNum(height) ? height : result.height - top - bottom;
                const out_width = isNum(width) ? width : result.width - left - right;

                ({ data: values } = geowarp({
                    debug_level: debugLevel - 1,
                    in_data: values,
                    in_bbox: bbox,
                    in_layout: current_layout,
                    in_srs: result.projection,
                    in_width: result.width,
                    in_height: result.height,
                    out_bbox: bbox,
                    out_layout: layout,
                    out_srs: result.projection,
                    out_height,
                    out_width,
                    method: method || "median",
                    round,
                    theoretical_min: undefined,
                    theoretical_max: undefined
                }));
                current_height = out_height;
                current_width = out_width;
            }

            if (current_layout !== layout) {
                ({ data: values } = xdim.transform({
                    data: values,
                    from: current_layout,
                    to: layout,
                    sizes: {
                        band: 1, // .asc files are always only 1 band
                        row: current_height,
                        column: current_width
                    }
                }));
            }

            return values;
        };
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}
