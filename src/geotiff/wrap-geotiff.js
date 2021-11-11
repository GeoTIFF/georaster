import GeoTIFFfrom from "geotiff-from";
// import toCanvas from "georaster-to-canvas";
import { Worker } from "universal-worker";
import xdim from "xdim";
import { runOnlyOnce } from "worker-fns";

import addLegacyFields from "../add-legacy-fields.js";
import addLegacyFns from "../add-legacy-fns.js";
import addSaveFunctions from "../add-save-funcs.js";
import checkByteLength from "../checkers/check-byte-length.js";
import merge from "../merge.js";
import preprocess from "../preprocess.js";
import resize from "../resize.js";

/**
 * @name wrapGeoTIFF
 * @param {Object} options - { data, debugLevel, calcStats, findOverview }
 * @param {Object|String} options.data - your data
 * @param {Number} options.debugLevel
 * @param {Boolean} options.calcStats
 * @param {Boolean} options.findOverview
 * @returns {Object} georaster
 */
export default async function wrapGeoTIFF() {
    // handle legacy wrapGeoTIFF(url)
    if (typeof arguments[0] === "string") {
        return wrapGeoTIFF({ data: arguments[0], debugLevel: arguments[2] === true ? 1 : 0 });
    }

    // handle legacy wrapGeoTIFF(data);
    if (typeof arguments[0] === "object" && ["data", "debugLevel", "calcStats", "findOverview"].every(k => !(k in arguments[0]))) {
        return wrapGeoTIFF({ data: arguments[0], debugLevel: arguments[2] === true ? 1 : 0 });
    }

    let { data, debugLevel = 0, calcStats, findOverview = true } = arguments[0];

    calcStats ??= typeof data !== "string";

    // pre-process
    data = await preprocess(data);
    data.forEach(checkByteLength);

    const georaster = {};

    const worker = new Worker("./parse-geotiff.js");
    const worked = await runOnlyOnce(worker, { data, calcStats, debugLevel, findOverview });
    if (debugLevel >= 1) console.log("[georaster] data from worker:", worked);
    merge(georaster, worked);

    // re-parse, geotiff on the main thread
    // so we can use it later when we want to get values
    // we use the worked data because ArrayBuffer was detached earlier when sent to worker
    georaster._geotiff = GeoTIFFfrom({ data: worked._data, debug: debugLevel >= 2, ovr: true });

    addLegacyFields({ georaster, debugLevel });
    addLegacyFns({ georaster });
    addSaveFunctions({ georaster });

    georaster.read = async function ({
        debugLevel = 0,
        width: target_width,
        height: target_height,
        top = 0,
        left = 0,
        bottom = 0,
        right = 0,
        method = "median",
        resample = true,
        round = false,
        theoretical_min,
        theoretical_max,
        layout = "[band][row][column]"
    }) {
        const geotiff = await georaster._geotiff;

        // treat null values as zero
        if (left === null || left === undefined) left = 0;
        if (right === null || right === undefined) right = 0;
        if (top === null || top === undefined) top = 0;
        if (bottom === null || bottom === undefined) bottom = 0;

        const actual_height = georaster.height - top - bottom;
        if (debugLevel >= 1) console.log("[georaster] actual height:", actual_height);
        const actual_width = georaster.width - left - right;
        if (debugLevel >= 1) console.log("[georaster] actual height:", actual_width);

        const useResize =
            resample !== false &&
            ((target_height !== undefined && target_height !== null && target_height !== actual_height) ||
                (target_width !== undefined && target_width !== null && target_width !== actual_width));
        if (debugLevel >= 1) console.log("[georaster] will use resize:", useResize);

        const out_height = typeof target_height === "number" ? target_height : georaster.height - top - bottom;
        const out_width = typeof target_width === "number" ? target_width : georaster.width - left - right;

        // see if we can find a better image
        let selected_image = await geotiff.getImage(0);
        let selected_image_index = 0;
        let read_window = [left, top, georaster.width - right, georaster.height - bottom];
        if (target_height && target_width) {
            if (debugLevel >= 2) console.log("[georaster] getting image count");
            const imageCount = await geotiff.getImageCount();

            georaster._images ??= new Array(imageCount);

            for (let i = 1; i < imageCount; i++) {
                const subimage = (georaster._images[i] ??= await geotiff.getImage(i));

                const ratioX = subimage.getHeight() / georaster.height;
                if (debugLevel >= 3) console.log("[geotiff-read-bbox] ratioX:", ratioX);

                const ratioY = subimage.getWidth() / georaster.width;
                if (debugLevel >= 3) console.log("[geotiff-read-bbox] ratioY:", ratioY);

                const subImageHeight = target_height * ratioY;
                const subImageWidth = target_width * ratioX;
                if (debugLevel >= 3) console.log("[geotiff-read-bbox] subImageHeight:", subImageHeight);
                if (debugLevel >= 3) console.log("[geotiff-read-bbox] subImageWidth:", subImageWidth);

                if (subImageHeight >= target_height && subImageWidth >= target_width) {
                    selected_image = subimage;
                    selected_image_index = i;

                    // update read window
                    read_window = [
                        Math.floor(left * ratioX),
                        Math.floor(top * ratioY),
                        Math.ceil((georaster.width - right) * ratioX),
                        Math.ceil((georaster.height - bottom) * ratioY)
                    ];
                } else {
                    break;
                }
            }
        }

        if (debugLevel >= 2) console.log("[georaster] reading rasters");
        let values = await selected_image.readRasters({ window: read_window, resampleMethod: "NONE" });
        if (debugLevel >= 2) console.log("[georaster] finished reading rasters");
        let current_layout = "[band][row,column]";

        const read_height = read_window[3] - read_window[1];
        const read_width = read_window[2] - read_window[0];
        const read_area = read_height * read_width;
        if (!values.every(band => band.length === read_area)) {
            console.log("[georaster] read_height:", read_height);
            console.log("[georaster] read_width:", read_width);
            console.log("[georaster] values:", values);
            throw new Error("[georaster] uh oh. didn't read the amount of values we expected");
        }

        let result_height;
        let result_width;
        if (useResize) {
            if (debugLevel >= 1) console.log("[georaster] resizing");
            values = resize({
                debug_level: Math.max(0, debugLevel - 1),
                in_data: values,
                in_layout: current_layout,
                in_height: read_height,
                in_width: read_width,
                out_height,
                out_width,
                out_layout: layout,
                method,
                round,
                theoretical_min,
                theoretical_max
            });
            if (debugLevel >= 1) console.log("[georaster] finished resizing");
            result_height = out_height;
            result_width = out_width;
            current_layout = layout;
        } else if (current_layout !== layout) {
            if (debugLevel >= 1) console.log("[georaster] transforming");
            ({ data: values } = xdim.transform({
                data: values,
                from: current_layout,
                to: layout,
                sizes: {
                    band: georaster.pixelDepth,
                    column: read_width,
                    row: read_height
                }
            }));
            if (debugLevel >= 1) console.log("[georaster] finished transforming");
            result_height = read_height;
            result_width = read_width;
        }

        return { values, actual_height, actual_width, iamge_index: selected_image_index, width: result_width, height: result_height };
    };

    return georaster;
}
