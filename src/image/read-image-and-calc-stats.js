import readim from "readim";
import calcStatsFn from "calc-stats";
import { transform } from "xdim";

export default async function readImageAndCalcStats({ data, calcStats = true }) {
    const { height, pixels, width } = await readim({ data });

    const numBands = pixels.length / (height * width);

    // transform from the flat interleaved format
    // to a more friendly band-separated format
    const { data: bands } = transform({
        data: pixels,
        from: "[row,column,band]",
        to: "[band][row,column]",
        sizes: {
            band: numBands,
            row: height,
            column: width
        }
    });


    const result = {
        height,
        width,
        numberOfBands: numBands,
        _data: bands
    };

    if (calcStats) {
        result.stats = bands.map(band => calcStatsFn(band, { calcHistogram: false }));
    }

    return result;
}
