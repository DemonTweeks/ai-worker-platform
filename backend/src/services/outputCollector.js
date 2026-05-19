const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { JobFile } = require('../models');
const storageService = require('./storageService');

const OUTPUT_EXTENSIONS = new Set(['.xls', '.xlsx', '.csv', '.json', '.txt']);

const classifyFileType = (fileName) => {
  const lower = fileName.toLowerCase();

  if (lower.includes('review')) {
    return 'review_required_report';
  }

  if (lower.includes('warning') || lower.includes('error')) {
    return 'warning_report';
  }

  if (lower.endsWith('.json')) {
    return 'summary';
  }

  return 'ecc_output';
};

const listFilesRecursive = async (directoryPath) => {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
};

const createZipPackage = async ({ jobId, outputFiles }) => {
  if (outputFiles.length === 0) {
    return null;
  }

  const zipPath = storageService.resolveJobOutputPath(jobId, `${jobId}-outputs.zip`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const filePath of outputFiles) {
      archive.file(filePath, { name: path.basename(filePath) });
    }

    archive.finalize();
  });

  const metadata = await storageService.buildFileMetadata(zipPath);
  return JobFile.create({
    jobId,
    fileType: 'zip_package',
    fileName: metadata.fileName,
    filePath: metadata.filePath,
    fileSize: metadata.fileSize,
    retentionUntil: metadata.retentionUntil
  });
};

const collectOutputs = async (jobId) => {
  const outputFolder = storageService.resolveJobFolderPath(jobId, 'output');
  const existingFiles = await listFilesRecursive(outputFolder);
  const collectableFiles = existingFiles.filter((filePath) => OUTPUT_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

  await JobFile.deleteMany({ jobId, fileType: { $in: ['ecc_output', 'review_required_report', 'warning_report', 'summary', 'zip_package'] } });

  const createdFiles = [];

  for (const filePath of collectableFiles) {
    if (path.basename(filePath).toLowerCase().endsWith('.zip')) {
      continue;
    }

    const metadata = await storageService.buildFileMetadata(filePath);
    const jobFile = await JobFile.create({
      jobId,
      fileType: classifyFileType(metadata.fileName),
      fileName: metadata.fileName,
      filePath: metadata.filePath,
      fileSize: metadata.fileSize,
      retentionUntil: metadata.retentionUntil
    });
    createdFiles.push(jobFile);
  }

  const zipFile = await createZipPackage({ jobId, outputFiles: collectableFiles });

  return {
    outputFiles: createdFiles,
    zipFile,
    outputFileCount: createdFiles.filter((file) => file.fileType === 'ecc_output').length
  };
};

module.exports = {
  collectOutputs
};
