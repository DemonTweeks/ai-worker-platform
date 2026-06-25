const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const config = require('../config/env');
const { RAN_RUN_MODES } = require('./workerTypes');

const GENERAL_ITEM_WORKBOOK = 'GENERAL ITEM FOR ALL DU PROJECT Overall.xlsx';
const MIN_PROJECT_COLUMN_INDEX = 4;

const getRanGeneralItemWorkbookPath = () => path.join(config.ranCreatePrCdRoot, 'config', GENERAL_ITEM_WORKBOOK);

const readWorkbookProjectHeaders = () => {
  const workbookPath = getRanGeneralItemWorkbookPath();

  if (!fs.existsSync(workbookPath)) {
    const error = new Error(`RAN project catalog workbook was not found: ${workbookPath}`);
    error.code = 'RAN_PROJECT_WORKBOOK_MISSING';
    throw error;
  }

  const workbook = xlsx.readFile(workbookPath, {
    cellDates: false,
    cellNF: false,
    cellStyles: false
  });

  const projects = new Set();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: ''
    });
    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];

    for (const value of headerRow.slice(MIN_PROJECT_COLUMN_INDEX)) {
      const project = String(value || '').trim();

      if (!project || project.toLowerCase() === 'nan' || project.startsWith('Unnamed')) {
        continue;
      }

      projects.add(project);
    }
  }

  return Array.from(projects).sort((left, right) => left.localeCompare(right));
};

const listRanProjects = () => readWorkbookProjectHeaders();

const isValidRanProject = (projectName) => {
  if (!projectName || typeof projectName !== 'string') {
    return false;
  }

  return listRanProjects().includes(projectName.trim());
};

const assertValidRanProject = (projectName) => {
  const normalized = String(projectName || '').trim();

  if (!normalized || !isValidRanProject(normalized)) {
    const error = new Error('Selected RAN General Item project is invalid.');
    error.code = 'INVALID_RAN_PROJECT';
    throw error;
  }

  return normalized;
};

const validateRanRunConfiguration = ({ runMode, selectedProject } = {}) => {
  const normalizedRunMode = String(runMode || '').trim();

  if (!Object.values(RAN_RUN_MODES).includes(normalizedRunMode)) {
    const error = new Error('RAN run mode must be standard-pr or general-item.');
    error.code = 'INVALID_RAN_RUN_MODE';
    throw error;
  }

  if (normalizedRunMode === RAN_RUN_MODES.STANDARD_PR) {
    return {
      runMode: normalizedRunMode,
      selectedProject: null
    };
  }

  return {
    runMode: normalizedRunMode,
    selectedProject: assertValidRanProject(selectedProject)
  };
};

module.exports = {
  GENERAL_ITEM_WORKBOOK,
  assertValidRanProject,
  getRanGeneralItemWorkbookPath,
  isValidRanProject,
  listRanProjects,
  validateRanRunConfiguration
};
