const mwPrManifest = require('./manifests/mwPrManifest');
const ranPrManifest = require('./manifests/ranPrManifest');
const mwPrAdapter = require('./adapters/mwPrAdapter');
const ranPrJobAdapter = require('./adapters/ranPrJobAdapter');
const { WORKER_IDS } = require('./workerTypes');

const registry = new Map([
  [WORKER_IDS.MW_PR, {
    manifest: mwPrManifest,
    adapterFactory: () => mwPrAdapter
  }],
  [WORKER_IDS.RAN_PR, {
    manifest: ranPrManifest,
    adapterFactory: () => ranPrJobAdapter
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
  if (!entry.adapterFactory) {
    const error = new Error(`Worker ${workerId} does not have an execution adapter.`);
    error.code = 'WORKER_ADAPTER_MISSING';
    throw error;
  }

  return entry.adapterFactory();
};

const listWorkers = () => Array.from(registry.values()).map(({ manifest }) => manifest);

module.exports = {
  getWorkerAdapter,
  getWorkerManifest,
  listWorkers
};
