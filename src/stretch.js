/**
 * @name stretch
 * @param {Array} values
 * @param {Object} options - { noData, min, max, strategy }
 * @param {Boolean} options.noData - no data value if one exists
 * @param {Number} options.min - minimum value
 * @param {Number} options.max - maximum value
 * @param {String} options.strategy - "jpg" or "png"
 * @returns {Array} stretched values
 */
export default function stretch(values, { noData, min, max, strategy = "png" }) {
    const range = max - min;
    if (strategy === "png") {
        return values.flatMap(n => {
            if (n === noData) {
                return [0, 0, 0, 0];
            } else {
                const scaled = 255 - Math.round(255 * ((n - min) / range));
                return [scaled, scaled, scaled, 255];
            }
        });
    } else if (strategy === "jpg") {
        return values.flatMap(n => {
            if (n === noData) {
                return [255, 255, 255];
            } else {
                // reserve 255 for no data values
                const scaled = 254 - Math.round(254 * ((n - min) / range));
                return [scaled, scaled, scaled];
            }
        });
    } else {
        throw new Error("[georaster] unknown stretch strategy");
    }
}
