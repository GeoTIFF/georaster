let parse_data = (data, debug) => {

    try {

        if (debug) console.log("starting parse_data with", data);
        if (debug) console.log("\tGeoTIFF:", typeof GeoTIFF);


        //console.log("parser:", parser);

        let result = {};

        let height, no_data_value, width;

        if (data.raster_type === "object") {
            result.values = data.data;
            result.height = height = data.metadata.height || result.values[0].length;
            result.width = width = data.metadata.width || result.values[0][0].length;
            result.pixelHeight = data.metadata.pixelHeight;
            result.pixelWidth = data.metadata.pixelWidth;
            result.projection = data.metadata.projection;
            result.xmin = data.metadata.xmin;
            result.ymax = data.metadata.ymax;
            result.no_data_value = no_data_value = data.metadata.no_data_value;
            result.number_of_rasters = result.values.length;
            result.xmax = result.xmin + result.width * result.pixelWidth;
            result.ymin = result.ymax - result.height * result.pixelHeight;
            result._data = null;
        } else if (data.raster_type === "geotiff") {
            result._data = data.data;
            
            let parser = typeof GeoTIFF !== "undefined" ? GeoTIFF : typeof window !== "undefined" ? window.GeoTIFF : typeof self !== "undefined" ? self.GeoTIFF : null;

            if (debug) console.log("data.raster_type is geotiff");
            let geotiff = parser.parse(data.data);
            if (debug) console.log("geotiff:", geotiff);

            let image = geotiff.getImage();
            if (debug) console.log("image:", image);

            let fileDirectory = image.fileDirectory;

            let geoKeys = image.getGeoKeys();

            if (debug) console.log("geoKeys:", geoKeys);
            result.projection = geoKeys.GeographicTypeGeoKey;
            if (debug) console.log("projection:", result.projection);

            result.height = height = image.getHeight();
            if (debug) console.log("result.height:", result.height);
            result.width = width = image.getWidth();
            if (debug) console.log("result.width:", result.width);            

            let [resolutionX, resolutionY, resolutionZ] = image.getResolution();
            result.pixelHeight = Math.abs(resolutionY);
            result.pixelWidth = Math.abs(resolutionX);

            let [originX, originY, originZ ] = image.getOrigin();
            result.xmin = originX;
            result.xmax = result.xmin + width * result.pixelWidth;
            result.ymax = originY;
            result.ymin = result.ymax - height * result.pixelHeight;

            result.no_data_value = no_data_value = fileDirectory.GDAL_NODATA ? parseFloat(fileDirectory.GDAL_NODATA) : null;
            //console.log("no_data_value:", no_data_value);

            result.number_of_rasters = fileDirectory.SamplesPerPixel;

            result.values = image.readRasters().map(values_in_one_dimension => {
                let values_in_two_dimensions = [];
                for (let y = 0; y < height; y++) {
                    let start = y * width;
                    let end = start + width;
                    values_in_two_dimensions.push(values_in_one_dimension.slice(start, end));
                }
                return values_in_two_dimensions;
            });
        }

        result.maxs = [];
        result.mins = [];
        result.ranges = [];

        let max; let min;

        //console.log("starting to get min, max and ranges");
        for (let raster_index = 0; raster_index < result.number_of_rasters; raster_index++) {

            let rows = result.values[raster_index];
            if (debug) console.log("[georaster] rows:", rows);

            for (let row_index = 0; row_index < height; row_index++) {

                let row = rows[row_index];

                for (let column_index = 0; column_index < width; column_index++) {

                    let value = row[column_index];
                    if (value != no_data_value) {
                        if (typeof min === "undefined" || value < min) min = value;
                        else if (typeof max === "undefined" || value > max) max = value;
                    }
                }
            }

            result.maxs.push(max);
            result.mins.push(min);
            result.ranges.push(max - min);
        }

        return result;

    } catch (error) {

        console.error("[georaster] error parsing georaster:", error);

    }

}