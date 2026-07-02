const { Job } = require('../models');

const padSequence = (sequence) => String(sequence).padStart(3, '0');
const jobIdReservations = new Map();
const reservedJobIds = new Set();

const formatDatePart = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const buildJobId = (date = new Date(), sequence = 1) => (
  `PR-${formatDatePart(date)}-${padSequence(sequence)}`
);

const withJobIdReservation = async (prefix, operation) => {
  const inFlightReservation = jobIdReservations.get(prefix);

  if (inFlightReservation) {
    await inFlightReservation.catch(() => {});
    return withJobIdReservation(prefix, operation);
  }

  let releaseReservation;
  const reservationPromise = new Promise((resolve) => {
    releaseReservation = resolve;
  });
  jobIdReservations.set(prefix, reservationPromise);

  try {
    return await operation();
  } finally {
    jobIdReservations.delete(prefix);
    releaseReservation();
  }
};

const reserveUniqueJobId = async (date = new Date()) => {
  const prefix = `PR-${formatDatePart(date)}-`;
  const jobId = await withJobIdReservation(prefix, async () => {
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
      const candidateJobId = `${prefix}${padSequence(sequence)}`;

      if (reservedJobIds.has(candidateJobId)) {
        continue;
      }

      const existing = await Job.exists({ jobId: candidateJobId });

      if (!existing) {
        reservedJobIds.add(candidateJobId);
        return candidateJobId;
      }
    }

    throw new Error('Unable to generate a unique job ID');
  });

  return {
    jobId,
    release: () => {
      reservedJobIds.delete(jobId);
    }
  };
};

const generateUniqueJobId = async (date = new Date()) => {
  const reservation = await reserveUniqueJobId(date);
  reservation.release();
  return reservation.jobId;
};

module.exports = {
  buildJobId,
  formatDatePart,
  generateUniqueJobId,
  reserveUniqueJobId
};
