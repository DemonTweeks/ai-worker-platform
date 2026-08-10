const registry = new Map([
  ['create-pr-cd', {
    manifestFactory: () => {
      const skill = require('../skills/skillPackageService').loadApprovedSkill('create-pr-cd');
      return { ...skill.manifest, workerId: skill.manifest.skillId, engineVersion: skill.manifest.version, engineCommit: null };
    },
    adapterFactory: () => ({ run: require('../skills/genericSkillRunner').runGenericSkillJob })
  }],
  ['tx-pr-auditor', {
    manifestFactory: () => {
      const skill = require('../skills/skillPackageService').loadApprovedSkill('tx-pr-auditor');
      return { ...skill.manifest, workerId: skill.manifest.skillId, engineVersion: skill.manifest.version, engineCommit: null };
    },
    adapterFactory: () => ({ run: require('../skills/genericSkillRunner').runGenericSkillJob })
  }],
  ['create-pr-cd-ran', {
    manifestFactory: () => {
      const skill = require('../skills/skillPackageService').loadApprovedSkill('create-pr-cd-ran');
      return { ...skill.manifest, workerId: skill.manifest.skillId, engineVersion: skill.manifest.version, engineCommit: null };
    },
    adapterFactory: () => ({ run: require('../skills/genericSkillRunner').runGenericSkillJob })
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

const getWorkerManifest = (workerId) => {
  const entry = assertRegisteredWorker(workerId);
  return entry.manifestFactory ? entry.manifestFactory() : entry.manifest;
};

const getWorkerAdapter = (workerId) => {
  const entry = assertRegisteredWorker(workerId);
  if (!entry.adapterFactory) {
    const error = new Error(`Worker ${workerId} does not have an execution adapter.`);
    error.code = 'WORKER_ADAPTER_MISSING';
    throw error;
  }

  return entry.adapterFactory();
};

const listWorkers = () => Array.from(registry.keys()).map(getWorkerManifest);

module.exports = {
  getWorkerAdapter,
  getWorkerManifest,
  listWorkers
};
