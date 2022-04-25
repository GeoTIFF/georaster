import parseData from './parseData.js';

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
