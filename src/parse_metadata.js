const findTagByPath = require('xml-utils/src/find-tag-by-path');

const parseISO = xml => {
  const results = {};

  try {
    results.projection = parseFloat(findTagByPath(xml, ['gmd:RS_Identifier','gmd:code','gco:CharacterString']).inner);
  } catch (error) {
    console.error(error);
  }

  try {
    results.xmin = parseFloat(findTagByPath(xml, ['gmd:westBoundLongitude','gco:Decimal']).inner);
    results.xmax = parseFloat(findTagByPath(xml, ['gmd:eastBoundLongitude','gco:Decimal']).inner);
    results.ymin = parseFloat(findTagByPath(xml, ['gmd:southBoundLatitude','gco:Decimal']).inner);
    results.ymax = parseFloat(findTagByPath(xml, ['gmd:northBoundLatitude','gco:Decimal']).inner);
  } catch (error) {
    console.error(error);
  }

  console.log('results:', results);

  return results;
};

module.exports = {
  parseISO,
};
