const xml = require('simple-xml-dom');
const xpath = require('xpath');

const parseISO = metadata => {
  const results = {};

  const dom = xml.parse(metadata);

  const select = xpath.useNamespaces({
    gco: 'http://www.isotc211.org/2005/gco',
    gmd: 'http://www.isotc211.org/2005/gmd',
  });

  try {
    results.projection = parseFloat(select('string(//gmd:RS_Identifier//gmd:code//gco:CharacterString/text())', dom));
  } catch (error) {
    console.error(error);
  }

  try {
    results.xmin = parseFloat(select('string(//gmd:westBoundLongitude//gco:Decimal/text())', dom));
    results.xmax = parseFloat(select('string(//gmd:eastBoundLongitude//gco:Decimal/text())', dom));
    results.ymin = parseFloat(select('string(//gmd:southBoundLatitude//gco:Decimal/text())', dom));
    results.ymax = parseFloat(select('string(//gmd:northBoundLatitude//gco:Decimal/text())', dom));
  } catch (error) {
    console.error(error);
  }

  console.log('results:', results);

  return results;
};

module.exports = {
  parseISO,
};
