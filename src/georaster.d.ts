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
  projection: unknown;
  /** left boundary, in units of projection*/
  xmin: number;
  /** right boundary, in units of projection */
  xmax: number;
  /** top boundary (image y-axis is inverse of cartesian), in units of projection */
  ymin: number;
  /** bottom boundary (image y-axis is inverse of cartesian), in units of projection */
  ymax: number;
  /** cell value representing "no data" in raster */
  noDataValue: number;
  /** number of raster bands */
  numberOfRasters: number;
  /** Minimum cell value for each raster band.  Indexed by band number */
  mins: number[]
  /** Maximum cell value for each raster band.  Indexed by band number */
  maxs: number[]
  /** difference between max and min for each raster band.  Indexed by band number */
  ranges: number[]
}

/** Subset of Georaster properties */
export type GeorasterMetadata = Pick<Georaster, 'noDataValue' | 'projection' | 'xmin' | 'ymax' | 'pixelWidth' | 'pixelHeight'>

export function parseGeoraster(data: object | string | Buffer | ArrayBuffer | number[][][],
    metadata: GeorasterMetadata,
    debug: boolean
): Promise<Georaster>
