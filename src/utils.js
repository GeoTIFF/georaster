const { fetch } = require('cross-fetch');


function urlExists(url) {
  try {
    return fetch(url, {method: 'HEAD'})
    .then(response => response.status === 200);
  } catch (error) {
    return false;
  }
}

function postMessage(worker, message) {
  // filter everything that can be transfered
  const transfer = Object.values(message)
    .filter(value => typeof value === 'ArrayBuffer');

  worker.postMessage(message, transfer);
}

const runWorker = (Worker, message) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker();
    worker.onmessage = resolve;
    postMessage(worker, message);
  });
}


function isBinary(input) {
  return input instanceof ArrayBuffer || input instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(input));
}

module.exports = {
  isBinary,
  postMessage,
  runWorker,
  urlExists,
}