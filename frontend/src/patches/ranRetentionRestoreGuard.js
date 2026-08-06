const RETAINED_UPLOAD_WARNING = 'One or more previously validated RAN uploads are no longer available. Please select the missing workbook again.';

export const hasFailedStoredRanUpload = ({
  stored = {},
  ranBomPrevalidation = null,
  ranEpmsPrevalidation = null
} = {}) => Boolean(
  (stored.bomPrevalidatedFileId && !ranBomPrevalidation)
  || (stored.epmsPrevalidatedFileId && !ranEpmsPrevalidation)
);

export const applyRanRetentionRestoreGuard = (component) => {
  const methods = component && component.methods;
  const originalRestore = methods && methods.restoreReusableRanUploads;

  if (typeof originalRestore !== 'function' || originalRestore.issue78Guarded) return;

  const guardedRestore = async function guardedRestoreReusableRanUploads(...args) {
    const stored = this.getStoredReusableRanUploads();
    const result = await originalRestore.apply(this, args);
    const restoreFailed = hasFailedStoredRanUpload({
      stored,
      ranBomPrevalidation: this.ranBomPrevalidation,
      ranEpmsPrevalidation: this.ranEpmsPrevalidation
    });

    if (!restoreFailed && this.commandNotice === RETAINED_UPLOAD_WARNING) {
      this.commandNotice = '';
    }

    return result;
  };

  guardedRestore.issue78Guarded = true;
  methods.restoreReusableRanUploads = guardedRestore;
};

export default applyRanRetentionRestoreGuard;
