const fs = require('fs');
const path = require('path');
const { JobFile } = require('../models');
const storageService = require('../services/storageService');
const { assertPathInsideRoot } = require('../utils/pathUtils');

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

  for (const definition of RAN_OUTPUT_DEFINITIONS) {
    const trackedFile = await copyApprovedOutput({ jobId, workspaceOutputRoot, definition });
    if (trackedFile) {
      trackedFiles.push(trackedFile);
    }
  }

  return {
    trackedFiles,
    outputFileCount: trackedFiles.length
  };
};

module.exports = {
  RAN_GENERATED_FILE_TYPES,
  RAN_OUTPUT_DEFINITIONS,
  ingestRanOutputs
};
