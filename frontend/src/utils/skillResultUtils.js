export const getSkillResultItems = (job = {}, fields = job.resultFields || []) => {
  const metrics = job.resultSummary?.metrics || {};
  return fields.map((field) => {
    const value = metrics[field.key];
    return {
      label: field.label || field.key,
      value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value ?? 'Pending')
    };
  });
};
