const hiddenCharactersPattern = /[\u200B-\u200D\uFEFF]/g;

const parseSiteCodes = (input = []) => {
  const rawValues = Array.isArray(input)
    ? input
    : String(input || '').split(/[\s,]+/);

  const seen = new Set();
  const siteCodes = [];
  const duplicateSiteCodes = [];

  for (const rawValue of rawValues) {
    const siteCode = String(rawValue || '')
      .replace(hiddenCharactersPattern, '')
      .trim()
      .toUpperCase();

    if (!siteCode) {
      continue;
    }

    if (seen.has(siteCode)) {
      duplicateSiteCodes.push(siteCode);
      continue;
    }

    seen.add(siteCode);
    siteCodes.push(siteCode);
  }

  return {
    siteCodes,
    duplicateSiteCodes: Array.from(new Set(duplicateSiteCodes)),
    requestedCount: rawValues.filter((value) => String(value || '').trim()).length,
    normalizedCount: siteCodes.length
  };
};

module.exports = {
  parseSiteCodes
};
