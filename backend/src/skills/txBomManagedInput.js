// Platform transport policy only. The approved Python package still requires epms/config.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const approval = require('./txBomManagedTemplate.json');
const { createApiError } = require('../utils/apiError');
const TOOLTIP = 'Auto fill — the backend automatically supplies the approved BOM template. No upload is required.';
const unavailable = () => createApiError(503, 'BOM_TEMPLATE_UNAVAILABLE',
  'The approved BOM template is unavailable or failed verification. Ask the administrator to provision the approved template, then refresh.');
const templatePath = () => config.txBomManagedTemplatePath || path.join(config.storageRoot, 'assets', 'tx-bom', approval.revision, approval.fileName);
const readTemplate = () => {
  try {
    const file = templatePath();
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > 104857600) throw unavailable();
    const buffer = fs.readFileSync(file);
    if (crypto.createHash('sha256').update(buffer).digest('hex') !== approval.sha256) throw unavailable();
    return { fieldname: 'config', originalname: approval.fileName, size: buffer.length, buffer,
      provenance: { origin: 'platform-managed', revision: approval.revision, fileName: approval.fileName, sha256: approval.sha256 } };
  } catch (_error) { throw unavailable(); }
};
const describeTemplate = () => {
  let available = true;
  try { readTemplate(); } catch (_error) { available = false; }
  return { origin: 'platform-managed', fileName: approval.fileName, revision: approval.revision,
    sha256: approval.sha256, available, tooltip: TOOLTIP,
    message: available ? 'Auto-filled · Managed by the platform' : unavailable().message };
};
const rejectOverrides = (skillId, files) => {
  if (skillId === 'tx-bom-generator' && files.some(file => file.fieldname === 'config')) {
    throw createApiError(400, 'BOM_TEMPLATE_OVERRIDE_FORBIDDEN', 'The BOM template is platform-managed. Upload only the EPMS workbook.');
  }
};
const catalogEntry = (entry) => entry.skillId !== 'tx-bom-generator' ? entry : ({ ...entry,
  managedInputs: { config: describeTemplate() },
  ui: { ...entry.ui, hero: { ...entry.ui.hero, subtitle: 'Upload EPMS and select Customer Site IDs. The approved BOM template is auto-filled by the backend.' } }
});
module.exports = { readTemplate, describeTemplate, rejectOverrides, catalogEntry };
