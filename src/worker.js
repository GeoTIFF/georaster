import parseData from './parseData.js';

// this is a bit of a hack to trick geotiff to work with web worker
// eslint-disable-next-line no-unused-vars
const window = self;

onmessage = e => {
  const data = e.data;
  parseData(data).then(result => {
    let transferBuffers = [];
    if ( result.values && (result.values[0][0].buffer instanceof ArrayBuffer) ) {
        transferBuffers = result.values.flat().map(r => r.buffer);
    }
    if (result._data instanceof ArrayBuffer) {
      transferBuffers.push(result._data);
    }
    postMessage(result, transferBuffers);
    close();
  });
};
