import GeoTIFFfrom from "geotiff-from";
import { getPalette } from "geotiff-palette";
import fixBuffer from "fix-buffer";
import { getStats } from "geotiff-stats";
import { parse } from "xdim";

export default async function parseGeoTIFF({ data, debugLevel = 0, calcStats, findOverview }) {
    // handle legacy wrapGeoTIFF(url)
    if (typeof arguments[0] === "string") {
        return parseGeoTIFF({ data: arguments[0], calcStats: false, debugLevel: arguments[2] === true ? 1 : 0 });
    }

    calcStats ??= typeof data !== "string";

    if (debugLevel >= 1) console.log("[georaster] starting parseGeoTIFF with", arguments[0]);

    const geotiff = await GeoTIFFfrom({ data, debug: debugLevel >= 3, ovr: findOverview });
    if (debugLevel >= 1) console.log("[georaster] geotiff:", typeof geotiff);
    const image = await geotiff.getImage(0);
    if (debugLevel >= 1) console.log("[georaster] image:", typeof image);

    const georaster = {
        _data: data,
        height: image.getHeight(),
        width: image.getWidth()
    };

    if (image.fileDirectory) {
        if (debugLevel >= 1) console.log("[georaster] image has a file directory");
        try {
            const [resolutionX, resolutionY] = image.getResolution();
            georaster.pixelHeight = Math.abs(resolutionY);
            georaster.pixelWidth = Math.abs(resolutionX);
        } catch (error) {
            console.error(error);
        }

        try {
            const [originX, originY] = image.getOrigin();
            georaster.xmin = originX;
            georaster.ymax = originY;
            if (typeof georaster.pixelHeight === "number") {
                georaster.ymin = georaster.ymax - georaster.height * georaster.pixelHeight;
            }
            if (typeof georaster.pixelWidth === "number") {
                georaster.xmax = georaster.xmin + georaster.width * georaster.pixelWidth;
            }
        } catch (error) {
            console.error(error);
        }

        const geoKeys = image.getGeoKeys();

        if (geoKeys) {
            // set projection information
            const { GeographicTypeGeoKey, ProjectedCSTypeGeoKey } = geoKeys;
            const code = GeographicTypeGeoKey || ProjectedCSTypeGeoKey;
            if (code) {
                // could probably create lib to get wkt or lookup in proj4-fully-loaded
                georaster.srs = { code };
            }
            georaster.noDataValue = image.getGDALNoData();
            georaster.pixelDepth = image.getSamplesPerPixel();
        }
    }

    if (debugLevel >= 1) console.log("[georaster] calcStats:", calcStats);
    if (calcStats) {
        georaster.stats = await getStats(image, { debug: debugLevel >= 2, enough: ["min", "max"] });
    }

    try {
        georaster.palette = getPalette(image, { debug: debugLevel >= 2 });
    } catch (error) {
        if (debugLevel >= 2) console.warn("[georaster] unable to get palette because of ", error);
    }

    return georaster;
}
