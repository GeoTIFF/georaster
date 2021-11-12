import calcStatsFn from "calc-stats";
import writeAuxXml from "aux-xml/write-aux-xml.js";
import flatIter from "flat-iter";

/**
 * @name saveAux
 * @description takes in a georaster and a given multi-dimensional array of values
 * and generates an aux.xml file from it
 * @param {Object} data
 * @param {Object} data.georaster
 * @param {Array} data.values
 * @returns {String} aux.xml file as a string
 */
export default function saveAux({ georaster, values }) {
    const meta = {};
    if (georaster.srs?.wkt) {
        meta.srs = georaster.srs?.wkt;
    }

    const stats = values.map(band => {
        // works for [band][row,column] and [band][row][column]
        const iter = flatIter(band);

        const options = {
            calcHistogram: false,
            calcMax: true,
            calcMean: true,
            calcMedian: false,
            calcMin: true,
            calcMode: false,
            calcModes: false,
            calcSum: false
        };
        return calcStatsFn(iter, options);
    });

    meta.bands = stats.reduce((result, bandStats, i) => {
        result[i] = {
            stats: {
                maximum: bandStats.max,
                minimum: bandStats.min,
                mean: bandStats.mean
            }
        };
        return result;
    }, {});

    return writeAuxXml(meta);
}
