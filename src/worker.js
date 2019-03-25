import parseData from './parseData.js';

// this is a bit of a hack to trick geotiff to work with web worker
// eslint-disable-next-line no-unused-vars
const window = self;

onmessage = e => {
  const data = e.data;
  parseData(data).then(result => {
    if (result._data instanceof ArrayBuffer) {
      postMessage(result, [result._data]);
    } else {
      postMessage(result);
    }
    close();
  });
};
