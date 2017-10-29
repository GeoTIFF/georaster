# georaster
Wrapper around Georeferenced Rasters like GeoTIFF, NetCDF, JPG, and PNG that provides a standard interface

# usage
```
let parse_georaster = require("georaster");
fetch(url)
  .then(response => response.arrayBuffer() )
  .then(parse_georaster)
  .then(georaster => {
      console.log("georaster:", georaster);
  });
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
  | values | two dimensional array of pixel values |
  | width | number of pixels wide raster is |
  | xmax | xmax in crs, which is often in longitude |
  | xmin | xmin in crs, which is often in longitude |
  | ymin | ymin in crs, which is often in latitude |
  | ymax | ymax in crs, which is often in latitude |
