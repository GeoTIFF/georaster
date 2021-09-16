function download_data {
  if [ -x "$(command -v wget)" ]; then
    wget "$1" -O "$2"
  elif [ -x "$(command -v curl)" ]; then
    curl "$1" --output "$2"
  fi
}

bucket="https://georaster.s3.amazonaws.com"

download_data "${bucket}/iso.xml" iso.xml
download_data "${bucket}/geonode_atlanteil.tif" geonode_atlanteil.tif
download_data "${bucket}/rgb_raster.tif" rgb_raster.tif
download_data "${bucket}/https://landsat-pds.s3.amazonaws.com/L8/012/031/LC80120312013106LGN01/LC80120312013106LGN01_B6.TIF" LC80120312013106LGN01_B6.tif
download_data "${bucket}/gadas-export.png" "gadas-export.png"
download_data "${bucket}/gadas-export.pgw" "gadas-export.pgw"
download_data "${bucket}/gadas-export.png.aux.xml" "gadas-export.png.aux.xml"

# jpg data
download_data "${bucket}/gadas-export.jpg" "gadas-export.jpg"
download_data "${bucket}/gadas-export.jgw" "gadas-export.jgw"
download_data "${bucket}/gadas-export.jpg.aux.xml" "gadas-export.jpg.aux.xml"
