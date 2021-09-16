import isAuxXML from "aux-xml/is-aux-xml.js";
import readWorldFile from "wld-reader";
import idJPG from "id-jpg";
import idPNG from "id-png";
import isWorldFile from "is-wld";
import { runOnlyOnce } from "worker-fns";
import geowarp from "geowarp";
import { Worker } from "universal-worker";

import fetchIf from "fetch-if";
import parseAuxXML from "../aux-xml/parse-aux-xml.js";
import addLegacyFields from "../add-legacy-fields.js";

export default async function wrapImage({ data, calcStats = true }) {
    if (data instanceof Promise) data = await data;

    if (!Array.isArray(data)) data = [data];

    // load JPG if not loaded yet
    const exts = [".jpg", ".jpeg", ".jgw", ".png", ".pgw", ".wld"];
    const condition = file => typeof file === "string" && exts.some(ext => file.toLowerCase().endsWith(ext));
    const files = await fetchIf({ items: data, condition });

    // find world file if exists
    const worldFile = files.find(isWorldFile);

    const imageFile = files.find(file => idJPG(file) || idPNG(file));

    const auxXMLFile = files.find(isAuxXML);

    const worker = new Worker("./read-image-and-calc-stats.js");
    const result = await runOnlyOnce(worker, { data: imageFile, calcStats });

    // add meta-data from the world file
    if (worldFile) {
        const affine = readWorldFile(worldFile);
        const { xScale, yScale, xSkew, ySkew, xOrigin, yOrigin } = affine;

        if (xSkew || ySkew) {
            const message = "[georaster] doesn't currently support rotated images";
            console.error(message);
            throw new Error(message);
        }

        result.xmin = xOrigin - 0.5 * xScale;
        result.ymax = yOrigin + 0.5 * yScale;
        result.xmax = result.xmin + result.width * xScale;
        result.ymin = result.ymax + result.height * yScale;
    }

    if (auxXMLFile) {
      const auxXMLData = parseAuxXML(auxXMLFile);
      if (auxXMLData) result.srs = {};
      if (auxXMLData.code) result.srs.code = auxXMLData.code;
      if (auxXMLData.wkt) result.srs.wkt = auxXMLData.wkt;  
    }

    addLegacyFields(result);

    result.getValues = function ({
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
    } = {}) {
      // use geowarp for clipping, resampling, and transforming
      const { data } = geowarp({
        debug_level: 0,
        in_data: result._data,
        in_bbox: [0, 0, result.width, result.height],
        in_layout: "[band][row,column]",
        in_width: result.width,
        in_height: result.height,
        out_bbox: [left, bottom, result.width - right, result.height - top],
        out_layout: layout,
        out_height:  height || result.height - top - bottom,
        out_width: width || result.width - left - right,
        method: method || "median",
        round,
        theoretical_min,
        theoretical_max
      });
      return data;
    };

    return result;
}
