declare function parseGeoraster(
  data: object | string | Buffer | ArrayBuffer | number[][][],
  /** the raster metadata */
  metadata?: parseGeoraster.GeorasterMetadata,
  /** whether or not to print debug statements */
  debug?: boolean
): Promise<parseGeoraster.Georaster>;

// Match default CJS export in index.js
export = parseGeoraster;

// A namespace with the same name as the default export is needed to define additional type exports
// https://stackoverflow.com/a/51238234/4159809
declare namespace parseGeoraster {
  export interface ValuesOptions {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
    resampleMethod?: 'nearest' | 'bilinear'
  }
  
  export interface Georaster {
    /** raster values.  first dimension is raster band, remainder is 2D array of cell values */
    values: number[][][];
    /** raster height in units of projection */
    height: number;
    /** raster width in units of projection */
    width: number;
    /** raster height in pixels */
    pixelHeight: number;
    /** raster width in pixels */
    pixelWidth: number;
    /** Projection identifier */
    projection: number;
    /** left boundary, in units of projection*/
    xmin: number;
    /** right boundary, in units of projection */
    xmax: number;
    /** bottom boundary, in units of projection */
    ymin: number;
    /** top boundary, in units of projection */
    ymax: number;
    /** cell value representing "no data" in raster */
    noDataValue: number;
    /** number of raster bands */
    numberOfRasters: number;
    /** Minimum cell value for each raster band.  Indexed by band number */
    mins: number[];
    /** Maximum cell value for each raster band.  Indexed by band number */
    maxs: number[];
    /** difference between max and min for each raster band.  Indexed by band number */
    ranges: number[];
    /** if raster initialized with a URL, this method is available to fetch a specific subset without reading entire raster into memory.  Useful for COGs */
    getValues?: (options: ValuesOptions) => Promise<number[][][]>;
    /** experimental! returns a canvas picture of the data. */
    toCanvas: (options: { height?: number; width?: number }) => ImageData
  }

  export type GeorasterMetadata = Pick<
    Georaster,
    | "noDataValue"
    | "projection"
    | "xmin"
    | "ymax"
    | "pixelWidth"
    | "pixelHeight"
  >;
}
