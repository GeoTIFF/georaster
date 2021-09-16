# GeoRaster
Universal interface that wraps around georeferenced raster grids like GeoTIFF, JPG, and PNG.
You can also create your own GeoRaster from simple JavaScript objects.

*note*: we'll be adding support for other types of geospatial grids like ASCII Grid soon.

# load from url on front-end
```javascript
import parseGeoRaster from "georaster";

// inside async function
const url = "https://landsat-pds.s3.amazonaws.com/c1/L8/024/030/LC08_L1TP_024030_20180723_20180731_01_T1/LC08_L1TP_024030_20180723_20180731_01_T1_B1.TIF";
const georaster = await parseGeoRaster(url);
```

# load from array buffer on front-end
```javascript
import parseGeoRaster from "georaster";

// inside async function
const response = await fetch(url);
const arrayBuffer = await response.arrayBuffer();
const georaster = await parseGeoRaster(arrayBuffer);
```

# load from file on back-end / NodeJS
```javascript
const parseGeoRaster = require("georaster");

const buffer = fs.readFileSync("data/GeogToWGS84GeoKey5.tif");

// inside async function
const georaster = await parseGeoRaster(data);
```

# load from simple object
```javascript
import parseGeoRaster from "georaster";

const data = [ [ [0, 1, 2], [0, 0, 0], [2, 1, 1] ] ];
const noDataValue = 3;
const projection = 4326;
const xmin = -40;
const ymax = 14;
const pixelWidth = 0.00001;
const pixelHeight = 0.00001;
const metadata = { noDataValue, projection, xmin, ymax, pixelWidth, pixelHeight };
const georaster = parseGeoRaster( { data, metadata } );
```

# getting pixel values
## getting all the pixel values
If you have a small GeoRaster and want to get all the pixel values you can run `georaster.getValues()`.
This will return a multi-dimensional array by band, then row, then column.
```javascript
const values = georaster.getValues();
// [band1, band2, band3, ...]
```

## getting a subsection of pixels
If you want to get only the pixels from a specific area in the GeoRaster,
you can run `georaster.getValues({ top, bottom, left, right })` passing in the following values:
- `top` is how many pixels from the **top** of the image to skip over before we start clipping
- `bottom` is how many pixels from the **bottom** of the image to skip over before we start clipping
- `left` is how many pixels in from the **left** side of the image to skip over before we start clipping
- `right` is how many pixels in from the **right** side of the image to skip over before we start clipping


## getting a lower-resolution sampling of pixels
If you want to get the pixels from an area at a lower resolution,
you can run `georaster.getValues({ width, height })` passing in the following values:
- `width` is how many pixels **wide** should be the returned image.
- `height` is how many pixels **tall** should be the returned image.

Example:
```javascript
const url = "https://landsat-pds.s3.amazonaws.com/c1/L8/024/030/LC08_L1TP_024030_20180723_20180731_01_T1/LC08_L1TP_024030_20180723_20180731_01_T1_B1.TIF";

const georaster = await parseGeoRaster(url);
const options = { left: 0, top: 0, right: 4000, bottom: 4000, width: 10, height: 10 };
// getting an image from a Landsat Scene that is 10 pixels tall and wide
const clipped_values = await georaster.getValues(options);
```

# properties
# required properties
| name | description |
| ---- | ----------- |
| maxs | array with max value for each band |
| mins | array with min value for each band |
| ranges | array with difference between max and min value for each band |
| noDataValue | no data value |
| pixelWidth | width of pixel in dimension of coordinate reference system |
| pixelHeight | height of pixel in dimension of coordinate reference system |
| projection | equal to EPSG code, like 4326 |
| width | number of pixels wide raster is |
| xmax | xmax in crs, which is often in longitude |
| xmin | xmin in crs, which is often in longitude |
| ymin | ymin in crs, which is often in latitude |
| ymax | ymax in crs, which is often in latitude |

# optional properties
| name | description |
| ---- | ----------- |
| palette | Array that maps raster values to RGBA colors |

# functions
| name | description |
| ---- | ----------- |
| getValues | get pixel values in multi-dimensional array.  The first dimension is an array of bands.  Each band is represented by a two-dimensional array (rows and then columns) |
| toCanvas | experimental! returns a canvas picture of the data.  You can pass in options object with height or width specified |

# loading georaster package through a script tag
```html
<script src="https://unpkg.com/georaster"></script>
```
You can view a simple demo of this [here](https://geotiff.github.io/georaster/test/)

# statistics calculations for large files
By default, if you run `georaster.parseGeoRaster(url)` with a url to a GeoTIFF, you won't
have the statistics (mins, maxs, ranges) calculated.  You can force the calculations of these
statistics by passing in a stats parameter like `parseGeoRaster(url, { stats: true })`

# Support
Post a Github issue or contact the package author, Daniel J. Dufour, at daniel.j.dufour@gmail.com
