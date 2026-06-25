const mwPrManifest = require('./manifests/mwPrManifest');
const ranPrManifest = require('./manifests/ranPrManifest');
const ranPrAdapter = require('./adapters/ranPrAdapter');
const { WORKER_IDS } = require('./workerTypes');

const registry = new Map([
  [WORKER_IDS.MW_PR, {
    manifest: mwPrManifest,
    adapterFactory: null
  }],
  [WORKER_IDS.RAN_PR, {
    manifest: ranPrManifest,
    adapterFactory: () => ranPrAdapter
  }]
]);

const assertRegisteredWorker = (workerId) => {
  const entry = registry.get(workerId);

  if (!entry) {
    const error = new Error(`Worker ${workerId} is not registered.`);
    error.code = 'WORKER_NOT_REGISTERED';
    throw error;
  }

  return entry;
};

const getWorkerManifest = (workerId) => assertRegisteredWorker(workerId).manifest;

const getWorkerAdapter = (workerId) => {
  const entry = assertRegisteredWorker(workerId);
  return entry.adapterFactory ? entry.adapterFactory() : null;
};

const listWorkers = () => Array.from(registry.values()).map(({ manifest }) => manifest);

module.exports = {
  getWorkerAdapter,
  getWorkerManifest,
  listWorkers
};
