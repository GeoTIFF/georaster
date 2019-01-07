# georaster
Wrapper around Georeferenced Rasters like GeoTIFF, NetCDF, JPG, and PNG that provides a standard interface.  You can also create your own georaster from simple JavaScript objects.

# load from url on front-end
```
const parseGeoraster = require("georaster");
fetch(url)
  .then(response => response.arrayBuffer() )
  .then(parseGeoraster)
  .then(georaster => {
      console.log("georaster:", georaster);
  });
```

# load from file on back-end
```
const parseGeoraster = require("georaster");
fs.readFile("data/GeogToWGS84GeoKey5.tif", (error, data) => {
    parseGeoraster(data).then(georaster => {
      console.log("georaster:", georaster);
    })
});
```

# load from simple object on front-end
```
const parseGeoraster = require("georaster");
const values = [ [ [0, 1, 2], [0, 0, 0], [2, 1, 1] ] ];
const noDataValue = 3;
const projection = 4326;
const xmin = -40;
const ymax = 14;
const pixelWidth = 0.00001;
const pixelHeight = 0.00001;
const metadata = { noDataValue, projection, xmin, ymax, pixelWidth, pixelHeight };
const georaster = parseGeoraster(values, metadata);
```

# properties
| name | description |
| ---- | ----------- |
| maxs | array with max value for each band |
| mins | array with min value for each band |
| ranges | array with difference between max and min value for each band |
| noDataValue | no data value |
| pixelWidth | width of pixel in dimension of coordinate reference system |
| pixelHeight | height of pixel in dimension of coordinate reference system |
| projection | equal to EPSG code, like 4326 |
| values | two dimensional array of pixel values |
| width | number of pixels wide raster is |
| xmax | xmax in crs, which is often in longitude |
| xmin | xmin in crs, which is often in longitude |
| ymin | ymin in crs, which is often in latitude |
| ymax | ymax in crs, which is often in latitude |

# loading georaster package through a script tag
```html
<script src="https://unpkg.com/georaster"></script>
```
You can view a simple demo of this [here](https://geotiff.github.io/georaster/test/)

# Support
Post a Github issue or contact the package author, Daniel J. Dufour, at daniel.j.dufour@gmail.com
