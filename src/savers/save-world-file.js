import writeWorldFile from "wld-writer";

export default function saveWorldFile({ georaster, left = 0, top = 0 }) {
    // create the world file info if it doesn't exist
    if (!georaster._wld) {
        georaster._wld = {
            xScale: georaster.pixelWidth,
            yScale: -1 * georaster.pixelHeight,
            ySkew: 0,
            xSkew: 0,
            xOrigin: georaster.xmin + 0.5 * georaster.pixelHeight,
            yOrigin: georaster.ymax - 0.5 * georaster.pixelHeight
        };
    }

    const { xOrigin, yOrigin, xScale, yScale } = georaster._wld;

    const worldFileAsString = writeWorldFile({
        xScale,
        yScale,
        ySkew: 0,
        xSkew: 0,
        xOrigin: xOrigin + left * yScale,
        yOrigin: yOrigin - top * xScale
    });

    return worldFileAsString;
}
