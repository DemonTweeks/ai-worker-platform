const fs = require('fs');
const path = require('path');
const { JobFile } = require('../models');
const storageService = require('../services/storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');
const { validateRanEccWorkbook } = require('./ranEccOutputValidationService');

const RAN_OUTPUT_DEFINITIONS = [
  {
    workspaceFileName: 'ECC_PR_Output.xlsx',
    trackedFileType: 'ran_ecc_output'
  },
  {
    workspaceFileName: 'ECC_PR_Output_With_GeneralItems.xlsx',
    trackedFileType: 'ran_ecc_output_with_general_items'
  }
];

const RAN_GENERATED_FILE_TYPES = RAN_OUTPUT_DEFINITIONS.map((definition) => definition.trackedFileType);

const buildFailureResult = (invalidOutputs) => ({
  code: invalidOutputs.length > 0 ? 'RAN_INVALID_ECC_OUTPUT' : 'RAN_ZERO_VALID_ECC_OUTPUT',
  message: 'RAN PR worker produced no valid ECC output files.',
  details: {
    invalidOutputCount: invalidOutputs.length,
    invalidOutputs
  }
});

const copyApprovedOutput = async ({ jobId, workspaceOutputRoot, definition }) => {
  const sourcePath = assertPathInsideRoot(
    workspaceOutputRoot,
    path.join(workspaceOutputRoot, definition.workspaceFileName)
  );

  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  const destinationPath = storageService.resolveJobOutputPath(jobId, definition.workspaceFileName);
  await fs.promises.copyFile(sourcePath, destinationPath);

  const metadata = await storageService.buildFileMetadata(destinationPath);
  return JobFile.create({
    jobId,
    fileType: definition.trackedFileType,
    fileName: metadata.fileName,
    filePath: metadata.filePath,
    fileSize: metadata.fileSize,
    retentionUntil: metadata.retentionUntil
  });
};

const ingestRanOutputs = async ({ jobId, workspaceOutputRoot }) => {
  await JobFile.deleteMany({ jobId, fileType: { $in: RAN_GENERATED_FILE_TYPES } });

  const trackedFiles = [];
  const invalidOutputs = [];

  for (const definition of RAN_OUTPUT_DEFINITIONS) {
    const sourcePath = assertPathInsideRoot(
      workspaceOutputRoot,
      path.join(workspaceOutputRoot, definition.workspaceFileName)
    );

    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const validation = await validateRanEccWorkbook({
      workbookPath: sourcePath,
      trackedFileType: definition.trackedFileType
    });

    if (!validation.valid) {
      invalidOutputs.push({
        trackedFileType: definition.trackedFileType,
        fileName: definition.workspaceFileName,
        reasonCode: validation.reasonCode,
        message: validation.message
      });
      continue;
    }

    const trackedFile = await copyApprovedOutput({ jobId, workspaceOutputRoot, definition });
    if (trackedFile) {
      trackedFiles.push(trackedFile);
    }
  }

  return {
    trackedFiles,
    outputFileCount: trackedFiles.length,
    validOutputFileCount: trackedFiles.length,
    invalidOutputFileCount: invalidOutputs.length,
    invalidOutputs,
    failure: trackedFiles.length === 0 ? buildFailureResult(invalidOutputs) : null
  };
};

module.exports = {
  RAN_GENERATED_FILE_TYPES,
  RAN_OUTPUT_DEFINITIONS,
  ingestRanOutputs
};
