const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { Job, JobFile } = require('../models');
const jobQueue = require('../queue/jobQueue');
const storageService = require('../services/storageService');
const {
  findJobByIdempotency,
  normalizeBrowserTabSessionId,
  normalizeIdempotencyKey,
  withIdempotencyReservation
} = require('../services/jobControlService');
const { reserveUniqueJobId } = require('../utils/jobIdGenerator');
const { createApiError } = require('../utils/apiError');
const { sanitizeFileName, toStorageRelativePath } = require('../utils/pathUtils');
const { listApprovedSkills, loadApprovedSkill, serializeCatalogEntry } = require('./skillPackageService');

const parseParameters = (value) => {
  if (value === undefined || value === '') return {};
  if (value && typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('not an object');
    return parsed;
  } catch (_error) {
    throw createApiError(400, 'PARAMETERS_INVALID', 'parameters must be a JSON object.');
  }
};

const validateParameterSchema = (parameters, schema = {}) => {
  const properties = schema.properties || {};
  const unknown = Object.keys(parameters).filter((key) => !Object.prototype.hasOwnProperty.call(properties, key));
  if (schema.additionalProperties === false && unknown.length) {
    throw createApiError(400, 'PARAMETERS_INVALID', 'Unsupported skill parameters were supplied.', { fields: unknown });
  }
  for (const required of schema.required || []) {
    if (parameters[required] === undefined || parameters[required] === null || parameters[required] === '') {
      throw createApiError(400, 'PARAMETERS_INVALID', `Parameter ${required} is required.`);
    }
  }
  for (const [key, value] of Object.entries(parameters)) {
    const rule = properties[key];
    if (!rule) continue;
    const validType = (
      (rule.type === 'string' && typeof value === 'string')
      || (rule.type === 'boolean' && typeof value === 'boolean')
      || (rule.type === 'integer' && Number.isInteger(value))
      || (rule.type === 'array' && Array.isArray(value))
      || (rule.type === 'object' && value && !Array.isArray(value) && typeof value === 'object')
    );
    if (rule.type && !validType) throw createApiError(400, 'PARAMETERS_INVALID', `Parameter ${key} has an invalid type.`);
    if (rule.enum && !rule.enum.includes(value)) throw createApiError(400, 'PARAMETERS_INVALID', `Parameter ${key} is not an allowed value.`);
    if (Number.isInteger(rule.minimum) && value < rule.minimum) throw createApiError(400, 'PARAMETERS_INVALID', `Parameter ${key} is below its minimum.`);
    if (Number.isInteger(rule.maximum) && value > rule.maximum) throw createApiError(400, 'PARAMETERS_INVALID', `Parameter ${key} exceeds its maximum.`);
  }
};

const validateUploads = (files, declarations) => {
  const declaredNames = new Set(declarations.map((item) => item.name));
  const unexpected = files.filter((file) => !declaredNames.has(file.fieldname));
  if (unexpected.length) throw createApiError(400, 'INPUT_FILE_INVALID', `Unexpected input field: ${unexpected[0].fieldname}.`);
  for (const declaration of declarations) {
    const matches = files.filter((file) => file.fieldname === declaration.name);
    if (declaration.required && matches.length === 0) throw createApiError(400, 'INPUT_FILE_REQUIRED', `${declaration.name} is required.`);
    if (!declaration.multiple && matches.length > 1) throw createApiError(400, 'INPUT_FILE_INVALID', `${declaration.name} accepts only one file.`);
    if (declaration.maximumCount && matches.length > declaration.maximumCount) throw createApiError(400, 'INPUT_FILE_LIMIT_EXCEEDED', `${declaration.name} exceeds its file-count limit.`);
    for (const file of matches) {
      const extension = path.extname(file.originalname || '').toLowerCase();
      if (!declaration.acceptedExtensions.map((item) => item.toLowerCase()).includes(extension)) {
        throw createApiError(400, 'INPUT_FILE_INVALID', `${declaration.name} has an unsupported extension.`);
      }
      if (declaration.maximumBytes && file.size > declaration.maximumBytes) {
        throw createApiError(413, 'INPUT_FILE_LIMIT_EXCEEDED', `${declaration.name} exceeds its size limit.`);
      }
    }
  }
};

const listSkillCatalog = () => ({ skills: listApprovedSkills().map(serializeCatalogEntry) });

const createSkillJob = async (skillId, body = {}, files = []) => {
  const skill = loadApprovedSkill(skillId);
  const parameters = parseParameters(body.parameters);
  validateParameterSchema(parameters, skill.manifest.inputs.parametersSchema);
  validateUploads(files, skill.manifest.inputs.files);
  const browserTabSessionId = normalizeBrowserTabSessionId(body.browserTabSessionId);
  const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);

  return withIdempotencyReservation({ workerId: skillId, idempotencyKey }, async () => {
    const replay = await findJobByIdempotency({ workerId: skillId, idempotencyKey });
    if (replay) return { created: false, job: replay, queue: jobQueue.getQueueState() };
    let jobId;
    let release;
    try {
      const reservation = await reserveUniqueJobId();
      jobId = reservation.jobId;
      release = reservation.release;
      const workspace = await storageService.createJobFolders(jobId);
      const inputFiles = [];
      for (const [index, file] of files.entries()) {
        const safeOriginal = sanitizeFileName(file.originalname);
        const storedName = `${file.fieldname}-${String(index + 1).padStart(3, '0')}-${safeOriginal}`;
        const destination = storageService.resolveJobInputPath(jobId, storedName);
        await storageService.saveBufferToFile(destination, file.buffer);
        inputFiles.push({
          name: file.fieldname,
          path: path.posix.join('input', storedName),
          originalFileName: safeOriginal,
          size: file.size,
          sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
          absolutePath: destination
        });
      }
      const inputEnvelope = {
        schemaVersion: '1.0',
        jobId,
        skill: { skillId, version: skill.manifest.version },
        parameters,
        files: inputFiles.map(({ absolutePath, ...item }) => item),
        paths: { workspace: '.', output: 'output', result: 'result.json', cancellation: 'temp/cancel.requested' }
      };
      const inputManifestPath = path.join(workspace.root, 'skill-input.json');
      await storageService.saveBufferToFile(inputManifestPath, Buffer.from(JSON.stringify(inputEnvelope, null, 2)));
      const retentionUntil = new Date(Date.now() + config.limits.fileRetentionDays * 86400000).toISOString();
      const job = await Job.create({
        jobId,
        workerId: skillId,
        workerType: 'skill',
        skillId,
        skillVersion: skill.manifest.version,
        skillContractVersion: skill.manifest.resultContractVersion,
        skillPackageSha256: skill.packageSha256,
        engineVersion: skill.manifest.version,
        engineCommit: null,
        status: 'queued',
        browserTabSessionId,
        idempotencyKey,
        parameters,
        fileRetentionUntil: retentionUntil,
        inputManifestPath: toStorageRelativePath(storageService.getStorageRoot(), inputManifestPath)
      });
      const jobFiles = await JobFile.insertMany(inputFiles.map((item) => ({
        jobId,
        fileType: 'skill_input',
        inputName: item.name,
        fileName: item.originalFileName,
        filePath: toStorageRelativePath(storageService.getStorageRoot(), item.absolutePath),
        fileSize: item.size,
        sha256: item.sha256,
        retentionUntil
      })));
      const queue = await jobQueue.enqueueJob(jobId);
      return { created: true, job, jobFiles, queue };
    } catch (error) {
      if (jobId) {
        await Promise.all([
          Job.deleteMany({ jobId }),
          JobFile.deleteMany({ jobId }),
          storageService.deleteFolderSafe(storageService.getJobRootPath(jobId)).catch(() => {})
        ]).catch(() => {});
      }
      throw error;
    } finally {
      if (release) release();
    }
  });
};

module.exports = {
  createSkillJob,
  listSkillCatalog,
  parseParameters,
  validateParameterSchema,
  validateUploads
};
