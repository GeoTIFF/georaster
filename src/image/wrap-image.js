import isAuxXML from "aux-xml/is-aux-xml.js";
import flatIter from "flat-iter";
import calcStatsFn from "calc-stats";
import readWorldFile from "wld-reader";
import idJPG from "id-jpg";
import idPNG from "id-png";
import isWorldFile from "is-wld";
import getDepth from "get-depth";
import { runOnlyOnce } from "worker-fns";
import geowarp from "geowarp";
import { Worker } from "universal-worker";
import writeImage from "write-image";
import { writeArrayBuffer } from "geotiff";
import toab from "toab";

import fetchIf from "fetch-if";
import parseAuxXML from "../aux-xml/parse-aux-xml.js";
import writeAuxXml from "aux-xml/write-aux-xml.js";
import addLegacyFields from "../add-legacy-fields.js";
import addLegacyFns from "../add-legacy-fns.js";
import addPixelSizes from "../add-pixel-sizes.js";
import checkByteLength from "../checkers/check-byte-length.js";
import normalizeExportFormat from "../normalize-export-format.js";
import preprocess from "../preprocess.js";
import saveAux from "../savers/save-aux.js";
import savePRJ from "../savers/save-prj.js";
import saveWorldFile from "../savers/save-world-file.js";
import addSaveFunctions from "../add-save-funcs.js";
import merge from "../merge.js";
import { hasStuff, pick } from "../utils.js";

export default async function wrapImage({ data, debugLevel = 0, calcStats = null }) {
    data = await preprocess(data);

    // load JPG if not loaded yet
    const exts = [".jpg", ".jpeg", ".jgw", ".png", ".pgw", ".wld"];
    const condition = file => typeof file === "string" && exts.some(ext => file.toLowerCase().endsWith(ext));
    const files = await fetchIf({ items: data, condition });

    files.forEach(checkByteLength);

    // will hold result
    const georaster = {
        _auxs: []
    };

    // find world file if exists
    const worldFile = files.find(isWorldFile);

    const jpgFile = files.find(idJPG);
    const pngFile = files.find(idPNG);
    const imageFile = jpgFile || pngFile;
    georaster._format = jpgFile ? "JPG" : pngFile ? "PNG" : null;

    const auxXMLFiles = files.filter(isAuxXML);
    auxXMLFiles.forEach(auxXMLFile => {
        const parsed = parseAuxXML(auxXMLFile);
        merge(georaster, parsed);
        georaster._auxs.push(parsed._aux);
    });

    if (![true, false].includes(calcStats)) {
        // only calc stats by default if min and max aren't present for every band
        calcStats = !(
            typeof georaster.stats === "object" &&
            Array.isArray(georaster.stats.bands) &&
            georaster.stats.bands.length > 0 &&
            georaster.stats.bands.every(it => "min" in it && "max" in it)
        );
    }

    const worker = new Worker("./read-image-and-calc-stats.js");
    if (debugLevel >= 1) console.log("[georaster] constructred worker:", typeof worker);
    const worked = await runOnlyOnce(worker, { data: imageFile, calcStats, debugLevel });
    merge(georaster, worked);

    // add meta-data from the world file
    if (worldFile) {
        const affine = (georaster._wld = readWorldFile(worldFile));
        const { xScale, yScale, xSkew, ySkew, xOrigin, yOrigin } = affine;

        if (xSkew || ySkew) {
            const message = "[georaster] doesn't currently support rotated images";
            console.error(message);
            throw new Error(message);
        }

        georaster.pixelWidth = Math.abs(xScale);
        georaster.pixelHeight = Math.abs(yScale);
        georaster.xmin = xOrigin - 0.5 * xScale;
        georaster.ymax = yOrigin + 0.5 * yScale;
        georaster.xmax = georaster.xmin + georaster.width * xScale;
        georaster.ymin = georaster.ymax + georaster.height * yScale;
    }

    // add pixelHeight and pixelWidth
    addPixelSizes({ georaster });
    addLegacyFields({ georaster, debugLevel });
    addLegacyFns({ georaster });
    addSaveFunctions({ georaster });

    georaster.read = function ({
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
        resample = true,
        layout = "[band][row][column]" // layout in xdim format, alternatives are [band][row,column] or [row,column,band]
    } = {}) {
        // use geowarp for clipping, resampling, and transforming
        const { data: values } = geowarp({
            debug_level: 0,
            in_data: georaster._data,
            in_bbox: [0, 0, georaster.width, georaster.height],
            in_layout: georaster._layout,
            in_width: georaster.width,
            in_height: georaster.height,
            out_bbox: [left, bottom, georaster.width - right, georaster.height - top],
            out_layout: layout,
            out_height: (resample !== false && height) || georaster.height - top - bottom,
            out_width: (resample !== false && width) || georaster.width - left - right,
            method: method || "median",
            round,
            theoretical_min,
            theoretical_max
        });
        return { values };
    };

    georaster.save = async function save({ format, height, width, left = 0, right = 0, top = 0, bottom = 0, quality, calcStats, ...rest } = {}) {
        if (!format) throw new Error("[georaster] can't save without a format");

        format = normalizeExportFormat(format);
        if (debugLevel >= 1) console.log(`[georaster] saving as "${format}"`);

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
            }
        });

        // treat nullish values as zero
        (left ??= 0), (right ??= 0), (top ??= 0), (bottom ??= 0);

        // handle sizes expressed as %
        if (typeof height === "string" && height.endsWith("%")) height = Math.round(georaster.height * (Number(height.replace("%", "")) / 100));
        if (typeof width === "string" && width.endsWith("%")) width = Math.round(georaster.width * (Number(width.replace("%", "")) / 100));
        if (typeof left === "string" && left.endsWith("%")) left = Math.round(georaster.width * (Number(left.replace("%", "")) / 100));
        if (typeof right === "string" && right.endsWith("%")) right = Math.round(georaster.width * (Number(right.replace("%", "")) / 100));
        if (typeof top === "string" && top.endsWith("%")) top = Math.round(georaster.height * (Number(top.replace("%", "")) / 100));
        if (typeof bottom === "string" && bottom.endsWith("%")) bottom = Math.round(georaster.height * (Number(bottom.replace("%", "")) / 100));

        width ??= georaster.width - left - right;
        height ??= georaster.height - top - bottom;

        const values = await georaster.getValues({ height, width, layout: "[band][row][column]", left, top, right, bottom, ...rest });

        // save .aux.xml
        if (["aux", "auxxml", "jpg", "png", "tif"].includes(format)) {
            result.files[".aux.xml"] = saveAux({ georaster, values });
        }

        // should we try to pull out alpha channel to NoData Value
        // probably better to keep as a separate band
        // because not sure how to decide what value should be no data
        // and alpha channel basically makes the whole pixel transparent
        // whereas no data values are per pixel
        if (["jpg", "png"].includes(format)) {
            console.log("writing format:", format);
            let { data: buf } = writeImage({
                data: values,
                debug: true,
                format,
                height,
                width,
                quality
            });
            if (buf.byteLength < 100) throw new Error("[georaster] uh oh. wrote really small buffer. that's not right.");
            result.files["." + format] = await toab(buf);
        } else if (["geotiff", "tif", "tiff"].includes(format)) {
            const meta = {
                height,
                width,
                ModelPixelScale: [georaster.pixelWidth, georaster.pixelHeight, 0],
                ModelTiepoint: [0, 0, 0, georaster.xmin, georaster.ymax, 0],
                PhotometricInterpretation: 2, // RGB
                // basically row-major order
                // https://www.awaresystems.be/imaging/tiff/tifftags/orientation.html
                Orientation: 1
            };
            if (values.length === 4) {
                // unassociated alpha/transparency band
                // https://www.awaresystems.be/imaging/tiff/tifftags/extrasamples.html
                meta.ExtraSamples = 2;
            } else {
                meta.ExtraSamples = 0;
            }

            // add projection information
            if (georaster.srs) {
                const { code, wkt } = georaster.srs;
                console.log("wkt:", wkt);
                if (code === 4326) {
                    meta.GeographicTypeGeoKey = code;
                    meta.GeogCitationGeoKey = "WGS 84";
                    meta.GTModelTypeGeoKey = 2; // ModelTypeGeographic
                } else {
                    meta.ProjectedCSTypeGeoKey = code;
                    // meta.PCSCitationGeoKey = // should parse citation from wkt
                    meta.GTModelTypeGeoKey = 1; // ModelTypeProjected
                }
            }

            console.log({ meta });
            result.files[".tif"] = await writeArrayBuffer(values, meta);
        }
        console.log("result of georaster(image).save is", { result, arguments });
        return result;
    };

    return georaster;
}
