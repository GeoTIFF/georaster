# georaster
Wrapper around Georeferenced Rasters like GeoTIFF, NetCDF, JPG, and PNG that provides a standard interface.  You can also create your own georaster from simple JavaScript objects.

# load from url on front-end
```
const parse_georaster = require("georaster");
fetch(url)
  .then(response => response.arrayBuffer() )
  .then(parse_georaster)
  .then(georaster => {
      console.log("georaster:", georaster);
  });
```

# load from file on back-end
```
const parse_georaster = require("georaster");
fs.readFile("data/GeogToWGS84GeoKey5.tif", (error, data) => {
    parse_georaster(data).then(georaster => {
      console.log("georaster:", georaster);
    })
});
```

# load from simple object on front-end
```
const parse_georaster = require("georaster");
const values = [ [ [0, 1, 2], [0, 0, 0], [2, 1, 1] ] ];
const no_data_value = 3;
const projection = 4326;
const xmin = -40;
const ymax = 14;
const pixelWidth = 0.00001;
const pixelHeight = 0.00001;
const metadata = { no_data_value, projection, xmin, ymax, pixelWidth, pixelHeight };
const georaster = parse_georaster(values, metadata);
```

# properties
| name | description |
| ---- | ----------- |
| maxs | array with max value for each band |
| mins | array with min value for each band |
| ranges | array with difference between max and min value for each band |
| no_data_value | no data value |
| pixelWidth | width of pixel in dimension of coordinate reference system |
| pixelHeight | height of pixel in dimension of coordinate reference system |
| projection | equal to EPSG code, like 4326 |
| values | two dimensional array of pixel values |
| width | number of pixels wide raster is |
| xmax | xmax in crs, which is often in longitude |
| xmin | xmin in crs, which is often in longitude |
| ymin | ymin in crs, which is often in latitude |
| ymax | ymax in crs, which is often in latitude |
