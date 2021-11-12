import GeoTIFFfrom from "geotiff-from";
import calcStatsFn from "calc-stats";
import flatIter from "flat-iter";
// import toCanvas from "georaster-to-canvas";
import { Worker } from "universal-worker";
import { runOnlyOnce } from "worker-fns";
import writeImage from "write-image";
import xdim from "xdim";

import addLegacyFields from "../add-legacy-fields.js";
import addLegacyFns from "../add-legacy-fns.js";
import addSaveFunctions from "../add-save-funcs.js";
import checkByteLength from "../checkers/check-byte-length.js";
import merge from "../merge.js";
import normalizeExportFormat from "../normalize-export-format.js";
import preprocess from "../preprocess.js";
import saveAux from "../savers/save-aux.js";
import saveWorldFile from "../savers/save-world-file.js";
import stretchFn from "../stretch.js";
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

    georaster.save = async function save({
        debugLevel,
        format,
        height,
        width,
        left = 0,
        right = 0,
        top = 0,
        bottom = 0,
        quality,
        stretch = true,
        calcStats,
        ...rest
    } = {}) {
        if (!format) throw new Error("[georaster] can't save without a format");

        format = normalizeExportFormat(format);
        if (debugLevel >= 1) console.log(`[georaster] saving as "${format}"`);

        // treat nullish values as zero
        (left ??= 0), (right ??= 0), (top ??= 0), (bottom ??= 0);

        // handle sizes expressed as %
        if (typeof height === "string" && height.endsWith("%")) height = Math.round(georaster.height * (Number(height.replace("%", "")) / 100));
        if (typeof width === "string" && width.endsWith("%")) width = Math.round(georaster.width * (Number(width.replace("%", "")) / 100));
        if (typeof left === "string" && left.endsWith("%")) left = Math.round(georaster.width * (Number(left.replace("%", "")) / 100));
        if (typeof right === "string" && right.endsWith("%")) right = Math.round(georaster.width * (Number(right.replace("%", "")) / 100));
        if (typeof top === "string" && top.endsWith("%")) top = Math.round(georaster.height * (Number(top.replace("%", "")) / 100));
        if (typeof bottom === "string" && bottom.endsWith("%")) bottom = Math.round(georaster.height * (Number(bottom.replace("%", "")) / 100));

        const result = {
            files: {}
        };

        if (["asc", "prj"].includes(format)) {
            if (georaster.srs?.wkt) {
                result.files[".prj"] = georaster.srs?.wkt;
            }
        }

        // save world file
        [
            ["jpg", ".jgw"],
            ["png", ".pgw"],
            ["geotiff", ".tfw"]
        ].forEach(([f, ext]) => {
            if (format === f) {
                result.files[ext] = saveWorldFile({ georaster, left, top });
                if (debugLevel >= 1) console.log(`[georaster] saved world file`);
            }
        });

        let actual_height = georaster.height - top - bottom;
        if (debugLevel >= 1) console.log("[georaster] actual height:", actual_height);
        let actual_width = georaster.width - left - right;
        if (debugLevel >= 1) console.log("[georaster] actual width:", actual_width);

        width ??= actual_width;
        height ??= actual_height;
        const resize = height !== actual_height || width !== actual_width;

        let values = await georaster.getValues({ height, width, layout: "[band][row][column]", left, top, right, bottom, ...rest });

        if (["aux", "auxxml", "jpg", "png", "tif"].includes(format)) {
            result.files[".aux.xml"] = saveAux({ georaster, values });
        }

        if (["jpg", "png"].includes(format)) {
            if (georaster.palette) {
                if (debugLevel >= 1) console.log("[georaster] using palette");
                const { palette } = georaster;
                values = values.flat(Infinity).map(value => palette[value]);
                if (debugLevel >= 1) console.log("[georaster] after applying paletter, values are:", values.slice(0, 10), "...");
            } else if (georaster.pixelDepth === 1) {
                if (debugLevel >= 1) console.log("[georaster] pixel depth is 1");
                let min, max;
                if (stretch) {
                    if (debugLevel >= 1) console.log("[georaster] stretching");
                    // filter out no data values
                    ({ min, max } = calcStatsFn(
                        flatIter(values, Infinity), // only 1 band
                        {
                            calcHistogram: false,
                            calcMax: true,
                            calcMean: false,
                            calcMedian: false,
                            calcMin: true,
                            calcMode: false,
                            calcModes: false,
                            calcSum: false
                        }
                    ));
                } else {
                    if (!georaster.stats) {
                        if (debugLevel >= 1)
                            console.warn(
                                "[georaster] you are trying to save a GeoTIFF, but we dont' have the statistics calculated, so let's grab the coarsest image and calc min/max on that"
                            );
                        // create array to hold images if it's not already created
                        georaster._images ??= new Array(await geotiff.getImageCount());
                        const last = georaster._images.length - 1;
                        const image = (georaster._images[last] ??= georaster._geotiff.getImage(last));
                        georaster.stats = await getStats(image, { debug: debugLevel >= 2, enough: ["min", "max"] });
                    }
                    ({ min, max } = georaster.stats.bands[0]);
                }

                values = stretchFn(values.flat(Infinity), { noData: georaster.noDataValue, min, max, strategy: format });
            } else if (pixelDepth === 2) {
                throw new Error(
                    "[georaster] georaster doesn't currently support 2-band imagery.  Please file a ticket here: https://github.com/geotiff/georaster/issues"
                );
            }
            const { data: buf } = writeImage({
                data: values,
                debug: debugLevel >= 2,
                format,
                height,
                width,
                quality
            });
            if (buf.byteLength < 100) throw new Error("[georaster] uh oh. wrote really small buffer. that's not right.");
            result.files["." + format] = await toab(buf);
        }

        return result;
    };

    return georaster;
}
