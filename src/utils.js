function countIn1D(array) {
  return array.reduce((counts, value) => {
    if (counts[value] === undefined) {
      counts[value] = 1;
    } else {
      counts[value]++;
    }
    return counts;
  }, {});
}

function countIn2D(rows) {
  return rows.reduce((counts, values) => {
    values.forEach(value => {
      if (counts[value] === undefined) {
        counts[value] = 1;
      } else {
        counts[value]++;
      }
    });
    return counts;
  }, {});
}

/*
Takes in a flattened one dimensional typed array
representing two-dimensional pixel values
and returns an array of typed arrays with the same buffer.
*/
function unflatten(valuesInOneDimension, size) {
  const {height, width} = size;
  const valuesInTwoDimensions = [];
  for (let y = 0; y < height; y++) {
    const start = y * width;
    const end = start + width;
    valuesInTwoDimensions.push(valuesInOneDimension.subarray(start, end));
  }
  return valuesInTwoDimensions;
}

module.exports = {countIn1D, countIn2D, unflatten};
