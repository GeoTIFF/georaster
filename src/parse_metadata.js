const findTagByPath = require('xml-utils/src/find-tag-by-path');


const parseISO = metadata => {
  const results = {};

  try {
    results.projection = parseFloat(findTagByPath(metadata, ['gmd:RS_Identifier', 'gmd:code', 'gco:CharacterString']).inner);
  } catch (error) {
    console.error(error);
  }

  try {
    results.xmin = parseFloat(findTagByPath(metadata, ['gmd:westBoundLongitude', 'gco:Decimal']).inner);
    results.xmax = parseFloat(findTagByPath(metadata, ['gmd:eastBoundLongitude', 'gco:Decimal']).inner);
    results.ymin = parseFloat(findTagByPath(metadata, ['gmd:southBoundLatitude', 'gco:Decimal']).inner);
    results.ymax = parseFloat(findTagByPath(metadata, ['gmd:northBoundLatitude', 'gco:Decimal']).inner);
  } catch (error) {
    console.error(error);
  }

  return results;
};

module.exports = {
  parseISO,
};
