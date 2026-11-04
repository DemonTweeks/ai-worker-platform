const LEGACY_SCOPES = ['TSS', 'TI'];
const MW_SCOPES = [...LEGACY_SCOPES, 'PLANNING'];
const normalizePrScope = (value, workerId) => {
  const scope = String(value || '').trim().toUpperCase();
  return (workerId === 'create-pr-cd' ? MW_SCOPES : LEGACY_SCOPES).includes(scope) ? scope : null;
};
module.exports = { LEGACY_SCOPES, MW_SCOPES, normalizePrScope };
