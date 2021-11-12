import readim from "readim";
import calcStatsFn from "calc-stats";
import { transform } from "xdim";

export default async function readImageAndCalcStats({ data, calcStats = true, debugLevel = 0 }) {
    if (debugLevel >= 1) console.log("[georaster] starting readImageAndCalcStats");
    // we read the whole image into memory because we assume that if it's a PNG or JPG
    // then it's not super large like a COG can be
    const { height, pixels, width } = await readim({ data, debug: debugLevel > 0 });
    if (debugLevel >= 1) console.log("[georaster] finished reading image data");

    const numBands = pixels.length / (height * width);

    const layout = "[band][row,column]";

    // transform from the flat interleaved format
    // to a more friendly band-separated format
    const { data: bands } = transform({
        data: pixels,
        from: "[row,column,band]",
        to: layout,
        sizes: {
            band: numBands,
            row: height,
            column: width
        }
    });

    const result = {
        height,
        width,
        // numberOfBands: numBands,
        pixelDepth: numBands,
        _data: bands,
        _layout: layout
    };

    if (calcStats) {
        result.stats = {
            bands: bands.map(band => calcStatsFn(band, { calcHistogram: false }))
        };
    }

    return result;
}
