<template>
  <div class="portal-shell">


    <section class="page-title-bar">
      <div>
        <p class="page-eyebrow">Configuration</p>
        <h2>Asset Configuration</h2>
      </div>
    </section>

    <section class="panel info-panel">
      <div class="info-panel-header">
        <span class="info-icon">ℹ️</span>
        <h2>Asset Management Not Active in Console</h2>
      </div>
      <div class="info-panel-content">
        <p class="muted">This page is intentionally informational for the current release.</p>
        <div class="info-box">
          <p>
            <strong>PR model</strong>, <strong>ECC template</strong>, and <strong>contract mapping</strong> are managed by the <code>create-pr-cd</code> skill at its checked-in defaults in <code>Info/input/</code>.
          </p>
        </div>
        <p class="helper-text">To change these inputs, update the skill assets repository and restart the worker services.</p>
        <div class="status-note">
          <span class="status-dot ok"></span>
          <span>Audit logs and Health are the active admin operations for this environment.</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'AdminAssetsView'
};
</script>