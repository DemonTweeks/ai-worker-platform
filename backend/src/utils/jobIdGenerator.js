const { Job } = require('../models');

const padSequence = (sequence) => String(sequence).padStart(3, '0');

const formatDatePart = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const buildJobId = (date = new Date(), sequence = 1) => (
  `PR-${formatDatePart(date)}-${padSequence(sequence)}`
);

const generateUniqueJobId = async (date = new Date()) => {
  const prefix = `PR-${formatDatePart(date)}-`;
  const latestJob = await Job.findOne({ jobId: new RegExp(`^${prefix}\\d{3,}$`) })
    .sort({ jobId: -1 })
    .select({ jobId: 1 })
    .lean();

  let nextSequence = 1;

  if (latestJob && latestJob.jobId) {
    const lastSequence = Number(latestJob.jobId.slice(prefix.length));
    nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
  }

  for (let sequence = nextSequence; sequence < nextSequence + 1000; sequence += 1) {
    const jobId = `${prefix}${padSequence(sequence)}`;
    const existing = await Job.exists({ jobId });

    if (!existing) {
      return jobId;
    }
  }

  throw new Error('Unable to generate a unique job ID');
};

module.exports = {
  buildJobId,
  formatDatePart,
  generateUniqueJobId
};
