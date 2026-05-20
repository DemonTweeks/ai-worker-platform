<template>
  <div class="portal-shell">
    <section class="hero-band">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Generation Asset Configuration</h1>
      </div>
    </section>

    <section class="panel">
      <h2>Business Assets are skill-owned</h2>
      <p>
        PR model, ECC template, and contract info mapping are now managed by the <strong>create-pr-cd</strong> skill
        at its checked-in defaults in <code>Info/input/</code>.
      </p>
      <p class="muted">Upload, activate, and versioning controls are intentionally disabled in the platform admin portal.</p>
      <p>Future configuration controls for operational settings can be added here.</p>
    </section>
  </div>
</template>

<script>
export default {
  name: 'AdminAssetsView'
};
</script>
