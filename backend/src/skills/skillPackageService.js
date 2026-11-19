const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const approvals = require('./approvedSkills.json');
const { assertPathInsideRoot } = require('../utils/pathUtils');

const SUPPORTED_CONTRACT_VERSIONS = new Set(['1.0']);
const NORMALIZED_TEXT_EXTENSIONS = new Set(['.json', '.md', '.py', '.toml', '.txt', '.yaml', '.yml']);

const toPosix = (value) => value.split(path.sep).join('/');
const patternToRegex = (pattern) => {
  const source = toPosix(pattern);
  let regex = '';
  for (let index = 0; index < source.length; index += 1) {
    if (source.slice(index, index + 3) === '**/') {
      regex += '(?:.*/)?';
      index += 2;
    } else if (source.slice(index, index + 2) === '**') {
      regex += '.*';
      index += 1;
    } else if (source[index] === '*') {
      regex += '[^/]*';
    } else {
      regex += source[index].replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${regex}$`);
};

// Glob segment states let us prune directories before opening them. A ** state
// consumes zero or more segments; all other segments consume exactly one.
const globStatesAfter = (segments, parts) => {
  const closure = (states) => {
    const result = new Set(states);
    for (const state of result) {
      if (segments[state] === '**') result.add(state + 1);
    }
    return result;
  };
  let states = closure(new Set([0]));
  for (const part of parts) {
    const next = new Set();
    for (const state of states) {
      if (segments[state] === '**') next.add(state);
      else if (state < segments.length && patternToRegex(segments[state]).test(part)) next.add(state + 1);
    }
    states = closure(next);
  }
  return states;
};

const resolveApproval = (skillId) => {
  const approval = approvals[skillId];
  if (!approval) {
    const error = new Error(`Skill ${skillId} is not approved.`);
    error.code = 'SKILL_NOT_APPROVED';
    throw error;
  }
  const root = path.resolve(config[approval.rootConfigKey]);
  return { approval, root };
};

const listRuntimeFiles = (root, include) => {
  const matchers = include.map(patternToRegex);
  const patterns = include.map((pattern) => toPosix(pattern).split('/'));
  const walk = (current, parts = []) => {
    const files = [];
    // Do not suppress errors: unreadable approved directories remain fatal.
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === '__pycache__') continue;
      const childParts = [...parts, entry.name];
      const relative = childParts.join('/');
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const canContainMatch = patterns.some((segments) =>
          [...globStatesAfter(segments, childParts)].some((state) => state < segments.length));
        if (canContainMatch) files.push(...walk(absolute, childParts));
      } else if (entry.isFile() && matchers.some((matcher) => matcher.test(relative))) {
        files.push(relative);
      }
    }
    return files;
  };
  return walk(root).sort();
};

const normalizeRuntimeContent = (relative, content) => {
  if (!NORMALIZED_TEXT_EXTENSIONS.has(path.extname(relative).toLowerCase())) {
    return content;
  }
  return Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
};

const calculatePackageFingerprint = (root, include) => {
  const files = listRuntimeFiles(root, include);
  if (files.length === 0) throw new Error(`Approved skill package at ${root} contains no runtime files.`);
  const packageHash = crypto.createHash('sha256');
  for (const relative of files) {
    const absolute = assertPathInsideRoot(root, path.join(root, relative));
    const content = normalizeRuntimeContent(relative, fs.readFileSync(absolute));
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');
    packageHash.update(relative);
    packageHash.update('\0');
    packageHash.update(fileHash);
    packageHash.update('\n');
  }
  return { sha256: packageHash.digest('hex'), files };
};

const validateManifest = (manifest, root, approval) => {
  if (!manifest || manifest.schemaVersion !== '1.0') throw new Error('Skill manifest schemaVersion must be 1.0.');
  if (!manifest.skillId || !approvals[manifest.skillId]) throw new Error('Skill manifest has an unapproved skillId.');
  if (manifest.version !== approval.approvedVersion) throw new Error(`Skill ${manifest.skillId} version is not approved.`);
  if (!SUPPORTED_CONTRACT_VERSIONS.has(manifest.resultContractVersion)) throw new Error('Skill result contract version is unsupported.');
  if (manifest.ui && manifest.ui.schemaVersion !== '1.0') throw new Error('Skill UI manifest schemaVersion must be 1.0.');
  if (!manifest.runtime || manifest.runtime.type !== 'python') throw new Error('Only Python skill runtimes are supported.');
  const entrypoint = assertPathInsideRoot(root, path.resolve(root, manifest.runtime.entrypoint || ''));
  if (!fs.statSync(entrypoint).isFile()) throw new Error('Skill entrypoint was not found.');
  if (!Array.isArray(manifest.inputs && manifest.inputs.files)) throw new Error('Skill manifest inputs.files must be an array.');
  return entrypoint;
};

const loadApprovedSkill = (skillId, ancestry = []) => {
  if (ancestry.includes(skillId)) throw new Error('Cyclic skill dependency.');
  const { approval, root } = resolveApproval(skillId);
  const manifestPath = assertPathInsideRoot(root, path.join(root, 'skill.json'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.skillId !== skillId) throw new Error(`Approved skill ID mismatch for ${skillId}.`);
  const entrypoint = validateManifest(manifest, root, approval);
  const fingerprint = calculatePackageFingerprint(root, approval.include);
  if (fingerprint.sha256 !== approval.approvedPackageSha256) {
    const error = new Error(`Skill ${skillId} package fingerprint is not approved.`);
    error.code = 'SKILL_PACKAGE_UNAPPROVED';
    error.details = { skillId, expected: approval.approvedPackageSha256, actual: fingerprint.sha256 };
    throw error;
  }
  const dependencies = (manifest.dependencies || []).map((declaration) => {
    const dependency = loadApprovedSkill(declaration.skillId, [...ancestry, skillId]);
    if (!Array.isArray(declaration.supportedVersions) || !declaration.supportedVersions.includes(dependency.manifest.version)) {
      const error = new Error(`Skill ${skillId} dependency ${declaration.skillId} version is incompatible.`);
      error.code = 'SKILL_DEPENDENCY_INCOMPATIBLE';
      throw error;
    }
    return dependency;
  });
  return { manifest, root, entrypoint, packageSha256: fingerprint.sha256, runtimeFiles: fingerprint.files, dependencies };
};

const listApprovedSkills = () => Object.keys(approvals).map((skillId) => loadApprovedSkill(skillId));

const serializeCatalogEntry = ({ manifest, packageSha256, dependencies = [] }) => ({
  skillId: manifest.skillId,
  displayName: manifest.displayName,
  version: manifest.version,
  inputs: manifest.inputs,
  ui: manifest.ui || null,
  execution: manifest.execution,
  resultContractVersion: manifest.resultContractVersion,
  dependencies: dependencies.map((dependency) => ({ skillId: dependency.manifest.skillId, version: dependency.manifest.version, packageSha256: dependency.packageSha256 })),
  packageSha256
});

module.exports = {
  SUPPORTED_CONTRACT_VERSIONS,
  calculatePackageFingerprint,
  listApprovedSkills,
  listRuntimeFiles,
  loadApprovedSkill,
  normalizeRuntimeContent,
  serializeCatalogEntry
};
