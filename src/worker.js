import parseData from './parseData.js';

// this is a bit of a hack to trick geotiff to work with web worker
// eslint-disable-next-line no-unused-vars
const window = self;

onmessage = e => {
  const data = e.data;
  parseData(data).then(result => {
    const transferBuffers = [];
    if ( result.values ) {
      let last;
      result.values.forEach(a => a.forEach(({buffer}) => {
        if (buffer instanceof ArrayBuffer && buffer !== last) {
          transferBuffers.push(buffer);
          last = buffer;
        }
      }));
    }
    if (result._data instanceof ArrayBuffer) {
      transferBuffers.push(result._data);
    }
    postMessage(result, transferBuffers);
    close();
  });
};
