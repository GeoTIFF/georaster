import test from "flug";
import findAndRead from "find-and-read";
import { GeoExtent } from "geo-extent";
import wrapImage from "../src/image/wrap-image.js";
import { displayAndWriteImage, unindent } from "./utils.js";

test("image: PNG without World File", async ({ eq }) => {
    const data = findAndRead("data/gadas-export.png");
    const georaster = await wrapImage({ data, calcStats: false });
    eq(georaster.pixelHeight, 1);
    eq(georaster.pixelWidth, 1);
    eq(georaster.height, 475);
    eq(georaster.width, 968);
    eq(georaster.maxs, undefined);
    eq(georaster.mins, undefined);
    eq(georaster.ranges, undefined);
    const values = await georaster.getValues();
    eq(values.length, 4);
    eq(values[0].length, 475);
    eq(values[0][0].length, 968);
    await displayAndWriteImage("png-no-wld.png", { data: values, height: georaster.height, width: georaster.width });
});

test("image: PNG with Auxiliary File and World File", async ({ eq }) => {
    const data = [
        findAndRead("data/gadas-export.png"),
        findAndRead("data/gadas-export.pgw", { encoding: "utf-8" }),
        findAndRead("data/gadas-export.png.aux.xml", { encoding: "utf-8" })
    ];
    const georaster = await wrapImage({ data, calcStats: true });
    eq(georaster.pixelHeight, 2445.98490512499);
    eq(georaster.pixelWidth, 2445.9849051249894);
    eq(georaster.height, 475);
    eq(georaster.width, 968);
    eq(georaster.stats.bands, [
        {
            median: 61,
            min: 0,
            max: 255,
            sum: 33119890,
            mean: 72.03107872988255,
            modes: [61],
            mode: 61
        },
        {
            median: 109,
            min: 0,
            max: 255,
            sum: 52234997,
            mean: 113.6037342322749,
            modes: [104],
            mode: 104
        },
        {
            median: 163,
            min: 0,
            max: 255,
            sum: 71075206,
            mean: 154.57852544584603,
            modes: [161],
            mode: 161
        },
        {
            median: 255,
            min: 255,
            max: 255,
            sum: 117249000,
            mean: 255,
            modes: [255],
            mode: 255
        }
    ]);
    eq(georaster.xmin, 7698736.857788673);
    eq(georaster.xmax, 10066450.245949663);
    eq(georaster.ymin, 160793.85307325143);
    eq(georaster.ymax, 1322636.6830076217);
    eq(georaster.projection, 3857);

    eq(georaster.maxs, [255, 255, 255, 255]);
    eq(georaster.mins, [0, 0, 0, 255]);
    eq(georaster.ranges, [255, 255, 255, 0]);
    const values = await georaster.getValues();
    eq(values.length, 4);
    eq(values[0].length, 475);
    eq(values[0][0].length, 968);
    await displayAndWriteImage("png-wld.png", { data: values, height: georaster.height, width: georaster.width });
});

test("image: clip Sri Lanka from geo-referenced PNG", async ({ eq }) => {
    const data = [
        findAndRead("data/gadas-export.png"),
        findAndRead("data/gadas-export.pgw", { encoding: "utf-8" }),
        findAndRead("data/gadas-export.png.aux.xml", { encoding: "utf-8" })
    ];
    const georaster = await wrapImage({ data, calcStats: false });

    const bbox = [79.140983, 5.582404, 82.14459, 10.159463];
    const ext = new GeoExtent(bbox, { srs: 4326 }).reproj(3857);

    const left = Math.floor((ext.xmin - georaster.xmin) / georaster.pixelWidth);
    const right = Math.floor((georaster.xmax - ext.xmax) / georaster.pixelHeight);
    const top = Math.floor((georaster.ymax - ext.ymax) / georaster.pixelHeight);
    const bottom = Math.floor((ext.ymin - georaster.ymin) / georaster.pixelHeight);
    const clippedHeight = georaster.height - top - bottom;
    const clippedWidth = georaster.width - left - right;
    const values = await georaster.getValues({ layout: "[band][row][column]", left, top, right, bottom });
    eq(values.length, 4);
    eq(values[0].length, clippedHeight);
    eq(values[0][0].length, clippedWidth);
    await displayAndWriteImage("png-sri-lanka.png", { data: values });
});

test(`image: png overflow`, async ({ eq }) => {
    const data = findAndRead("data/gadas-export.png");
    const georaster = await wrapImage({ data, debugLevel: 0, calcStats: false });
    const top = -500;
    const height = 475 - top;
    eq(georaster.pixelHeight, 1);
    eq(georaster.pixelWidth, 1);
    eq(georaster.height, 475);
    eq(georaster.width, 968);
    eq(georaster.maxs, undefined);
    eq(georaster.mins, undefined);
    eq(georaster.ranges, undefined);
    const values = await georaster.getValues({ top, bottom: 0, left: 0, right: 0 });
    eq(values.length, 4);
    eq(values[0].length, height);
    eq(values[0][0].length, 968);
    await displayAndWriteImage("overflow.png", { data: values, height, width: georaster.width });
});

test("image: save jpg/png", async ({ eq }) => {
    const wld = findAndRead("data/gadas-export.pgw", { encoding: "utf-8" });
    const data = [findAndRead("data/gadas-export.png"), wld, findAndRead("data/gadas-export.png.aux.xml", { encoding: "utf-8" })];

    const georaster = await wrapImage({ data, calcStats: false, debugLevel: 1 });

    const {
        files: { ".png": png, ".pgw": pgw }
    } = await georaster.save({ format: "PNG" });
    await displayAndWriteImage("gadas-export-converted.png", { data: png });
    eq(pgw, wld.replace(/\r/g, ""));

    const {
        files: { ".jpg": jpg, ".jgw": jgw }
    } = await georaster.save({ format: "JPG" });
    await displayAndWriteImage("gadas-export-converted.jpg", { data: jpg });
    eq(jgw, wld.replace(/\r/g, ""));
});

test("image: save geotiff", async ({ eq }) => {
    const data = [
        findAndRead("data/gadas-export.png"),
        findAndRead("data/gadas-export.pgw", { encoding: "utf-8" }),
        findAndRead("data/gadas-export.png.aux.xml", { encoding: "utf-8" })
    ];

    const georaster = await wrapImage({ data, calcStats: false, debugLevel: 1 });

    const { files } = await georaster.save({ format: "GeoTIFF" });
    await displayAndWriteImage("gadas-export-converted.tif", { data: files[".tif"] });

    // shouldn't write unecessary world files
    eq(files[".wld"], undefined);
    eq(files[".jgw"], undefined);
    eq(files[".pgw"], undefined);
});

test("image: save prj", async ({ eq }) => {
    const data = [
        findAndRead("data/gadas-export.png"),
        findAndRead("data/gadas-export.pgw", { encoding: "utf-8" }),
        findAndRead("data/gadas-export.png.aux.xml", { encoding: "utf-8" })
    ];
    const georaster = await wrapImage({ data, debugLevel: 0 });
    const { files } = await georaster.save({ format: "prj" });
    eq(Buffer.isBuffer(georaster._prj), false);
    eq(
        Buffer.from(files[".prj"]).toString(),
        'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]'
    );

    // shouldn't write unecessary world files
    eq(files[".wld"], undefined);
    eq(files[".jgw"], undefined);
    eq(files[".pgw"], undefined);
});

test("image: combined sidecars", async ({ eq }) => {
    const data = [
        findAndRead("data/gadas-export.png"),
        findAndRead("data/gadas-export.pgw", { encoding: "utf-8" }),
        findAndRead("data/gadas-export.png.aux.xml", { encoding: "utf-8" }),
        findAndRead("data/gadas-export-gdal.png.aux.xml", { encoding: "utf-8" })
    ];

    const georaster = await wrapImage({ data, debugLevel: 0 });

    eq(georaster._format, "PNG");

    // read from gadas-export.png.aux.xml
    eq(georaster.srs.code, 3857);
    eq(
        georaster.srs.wkt,
        'PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]'
    );

    // don't have median because stats weren't calculated,
    // but read from gadas-export-gdal.png.aux.xml
    eq(georaster.stats, {
        bands: [
            { max: 255, mean: 72.031078729883, min: 0 },
            { max: 255, mean: 113.60373423227, min: 0 },
            { max: 255, mean: 154.57852544585, min: 0 },
            { max: 255, mean: 255, min: 255 }
        ]
    });

    const { files } = await georaster.save({ format: "jpg" });

    eq(files[".jgw"].length > 10, true);

    await displayAndWriteImage("gadas-export-combined-sidecars.tif", { data: files[".jpg"] });

    eq(
        unindent(files[".aux.xml"]),
        unindent(`<PAMDataset>
    <SRS>PROJCS["WGS_1984_Web_Mercator_Auxiliary_Sphere",GEOGCS["GCS_WGS_1984",DATUM["WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Mercator_Auxiliary_Sphere"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",0.0],PARAMETER["Standard_Parallel_1",0.0],PARAMETER["Auxiliary_Sphere_Type",0.0],UNIT["Meter",1.0]]</SRS>
    <PAMRasterBand band="0">
      <Metadata>
        <MDI key="STATISTICS_MAXIMUM">255</MDI>
        <MDI key="STATISTICS_MEAN">71.93784362766421</MDI>
        <MDI key="STATISTICS_MINIMUM">0</MDI>
      </Metadata>
    </PAMRasterBand>
    <PAMRasterBand band="1">
      <Metadata>
        <MDI key="STATISTICS_MAXIMUM">255</MDI>
        <MDI key="STATISTICS_MEAN">113.63437146585471</MDI>
        <MDI key="STATISTICS_MINIMUM">26</MDI>
      </Metadata>
    </PAMRasterBand>
    <PAMRasterBand band="2">
      <Metadata>
        <MDI key="STATISTICS_MAXIMUM">255</MDI>
        <MDI key="STATISTICS_MEAN">154.67272618529796</MDI>
        <MDI key="STATISTICS_MINIMUM">0</MDI>
      </Metadata>
    </PAMRasterBand>
    <PAMRasterBand band="3">
      <Metadata>
        <MDI key="STATISTICS_MAXIMUM">255</MDI>
        <MDI key="STATISTICS_MEAN">255</MDI>
        <MDI key="STATISTICS_MINIMUM">255</MDI>
      </Metadata>
    </PAMRasterBand>
  </PAMDataset>`)
    );
});
