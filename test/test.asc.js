import { writeFileSync } from "fs";
import fixBuffer from "fix-buffer";
import test from "flug";
import findAndRead from "find-and-read";
import calcStats from "calc-stats";

import wrapAsciiGrid from "../src/ascii-grid/wrap-ascii-grid.js";
import parseGeoRaster from "../src/index.js";
import { displayAndWriteImage, getPublicProps } from "./utils.js";

test("asc: basic", async ({ eq }) => {
    const data = [findAndRead("michigan_lld.asc"), findAndRead("michigan_lld.prj")];

    const georaster = await wrapAsciiGrid({ data, debugLevel: 0 });

    const height = 5365;
    const width = 4201;

    const georasterProps = getPublicProps(georaster);

    eq(georasterProps, {
        height,
        noDataValue: -9999,
        pixelDepth: 1,
        numberOfRasters: 1,
        pixelHeight: 0.0008333333333,
        pixelWidth: 0.0008333333333,
        width,
        xmin: -88.00041666666665,
        xmax: -84.49958333347335,
        ymin: 41.619583333333345,
        ymax: 46.09041666648785,
        srs: {
            code: 4269,
            wkt: 'GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]'
        },
        stats: {
            bands: [
                {
                    max: 351.943481,
                    mean: 13.685328213781924,
                    median: 24.926056,
                    min: -275.890015,
                    mode: 6.894897,
                    modes: [6.894897],
                    sum: 304535462.0868404
                }
            ]
        },
        // legacy fields below
        projection: 4269,
        maxs: [351.943481],
        mins: [-275.890015],
        ranges: [627.833496]
    });
    eq(Buffer.isBuffer(georaster._prj), true);
    const values = await georaster.getValues({ debugLevel: 0 });
    eq(values.length, 1); // number of bands
    eq(values[0].length, height); // number of rows
    eq(values[0][0].length, width);
});

test("asc: parseGeoRaster", async ({ eq }) => {
    const georaster1 = getPublicProps(await wrapAsciiGrid({ data: findAndRead("michigan_lld.asc"), debugLevel: 0 }));
    delete georaster1._asc; // delete internal array buffer
    // delete georaster1.getValues;

    const georaster2 = await parseGeoRaster({ data: findAndRead("michigan_lld.asc"), debugLevel: 0 });
    delete georaster2._asc; // delete internal array buffer
    // delete georaster2.getValues;

    eq(getPublicProps(georaster1), getPublicProps(georaster2));
});

test("asc: thumbs", async ({ eq }) => {
    const height = 250;
    const width = 250;
    const data = findAndRead("Necker_20m.asc");
    const georaster = await wrapAsciiGrid({ data, debugLevel: 0, calcStats: false });

    // check private values
    eq(georaster._asc instanceof ArrayBuffer, true);
    eq(georaster._meta, {
        ncols: 5143,
        nrows: 4432,
        xllcorner: 491501,
        yllcorner: 2556440,
        cellsize: 20.0531,
        nodata_value: 99999,
        last_metadata_line: 5,
        last_metadata_byte: 92
    });

    const values = await georaster.getValues({ debugLevel: 0, layout: "[row,column,band]", height, width });
    eq(values.length, 62500);
    const stats = calcStats(values, { calcHistogram: false, noData: 99999 });
    eq(stats, {
        median: -333.36125,
        min: -1487,
        max: 49984.7622,
        sum: -1896797.601215003,
        mean: -386.15586343953646,
        modes: [-528.183, -1397, -331.287, -1280, -1395, -316.7955, -328.90999999999997, -349.012, -136.734],
        mode: -673.6579444444444
    });

    const {
        files: { ".png": png }
    } = await georaster.save({ format: "PNG", height, width, stretch: false });
    await displayAndWriteImage("asc-thumb.png", { data: png, height, width });

    const {
        files: { ".jpg": jpg }
    } = await georaster.save({ format: "JPG", height, width, stretch: false });
    await displayAndWriteImage("asc-thumb.jpg", { data: jpg, height, width });
});

test("ascii: convert to geotiff", async ({ eq }) => {
    const data = [findAndRead("michigan_lld.asc"), findAndRead("michigan_lld.prj")];

    const georaster = await wrapAsciiGrid({ data, debugLevel: 0 });

    const saved = await georaster.save({ format: "geotiff" });

    const buf = Buffer.from(saved.files[".tif"]);

    writeFileSync("michigan_lld.tif", buf);
});

test("ascii: resize 10%", async ({ eq }) => {
    const data = [findAndRead("michigan_lld.asc"), findAndRead("michigan_lld.prj")];

    const georaster = await wrapAsciiGrid({ data, debugLevel: 0 });

    const saved = await georaster.save({ debugLevel: 0, format: "asc", height: Math.round(georaster.height / 100) });

    writeFileSync("michigan_lld_resized.asc", saved.files[".asc"]);
});

test("ascii: overflow top", async ({ eq }) => {
    const data = [findAndRead("michigan_lld.asc"), findAndRead("michigan_lld.prj")];

    const georaster = await wrapAsciiGrid({ data, debugLevel: 0 });

    const top = -100;
    const bottom = georaster.height - 100;
    const left = -1;
    const right = 0;

    const values = await georaster.getValues({ debugLevel: 0, layout: "[band][row][column]", top, left, right, bottom });

    eq(values.length, 1); // band count
    eq(values[0].length, 200); // row count
    eq(values[0][0].length, georaster.width + 1); // column count
    eq(
        values[0].every(row => row[0] === georaster.noDataValue),
        true
    );
});

test("asc: save prj", async ({ eq }) => {
    const data = [findAndRead("michigan_lld.asc"), findAndRead("michigan_lld.prj")];
    const georaster = await wrapAsciiGrid({ data, debugLevel: 0 });
    const saved = await georaster.save({ format: "prj" });
    eq(Buffer.isBuffer(georaster._prj), true);
    eq(saved.files[".prj"].toString(), Buffer.from(data[1]).toString());
});
