import geowarp from "geowarp";

// just resize an image without reprojection
export default function resize({
    in_data,
    debug_level = 0,
    in_height,
    in_width,
    in_layout,
    out_height,
    out_width,
    out_layout,
    method = "median",
    round = false,
    theoretical_min,
    theoretical_max
}) {
    const bbox = [0, 0, in_width, in_height];
    return geowarp({
        debug_level,
        in_data,
        in_bbox: bbox,
        in_layout,
        in_width,
        in_height,
        out_bbox: bbox,
        out_layout,
        out_height,
        out_width,
        method: method || "median",
        round,
        theoretical_min,
        theoretical_max
    }).data;
}
