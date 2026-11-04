// Scope presentation only; approved skill manifests own input validation.
const SCOPE_WORKERS = new Set(['create-pr-cd', 'iepms-pr-upload-automation', 'mw-pr', 'ran-pr']);
const PLANNING_WORKERS = new Set(['create-pr-cd', 'iepms-pr-upload-automation']);
export const supportsPrScope = (workerId) => !workerId || SCOPE_WORKERS.has(workerId);
export const supportsPlanning = (workerId) => !workerId || PLANNING_WORKERS.has(workerId);
export const prScopeLabel = (scope) => scope === 'PLANNING' ? 'Planning' : scope;
