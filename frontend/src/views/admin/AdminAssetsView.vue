<template>
  <div class="portal-shell">
    <section class="hero-band">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Asset Configuration</h1>
      </div>
    </section>

    <section class="panel">
      <h2>Asset Management Not Active in Console</h2>
      <p class="muted">This page is intentionally informational for the current release.</p>
      <p>
        PR model, ECC template, and contract mapping are managed by the <strong>create-pr-cd</strong> skill at its checked-in defaults in <code>Info/input/</code>.
      </p>
      <p>To change these inputs, update the skill assets repository and restart the worker services.</p>
      <p class="muted">Audit logs and Health are the active admin operations for this environment.</p>
    </section>
  </div>
</template>

<script>
export default {
  name: 'AdminAssetsView'
};
</script>
