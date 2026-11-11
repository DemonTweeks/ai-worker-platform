<template>
  <section class="tipic-artifacts" aria-labelledby="tipic-title">
    <header>
      <p class="eyebrow">External resources</p>
      <h2 id="tipic-title">TX Dashboard</h2>
      <p class="tipic-intro">Quick access to site lookup tools and project dashboards.</p>
    </header>

    <aside class="tipic-access-note" aria-labelledby="tipic-access-title">
      <h3 id="tipic-access-title">UAC environment required</h3>
      <p>
        Please access
        <a href="https://tipic.zx.zte.com.cn/tipic/" target="_blank" rel="noopener noreferrer">https://tipic.zx.zte.com.cn/tipic/</a>
        in the UAC environment and sign in before opening the artifacts below.
      </p>
      <p>All links open in a new tab. This page does not download or embed TIPIC content.</p>
    </aside>

    <ul class="tipic-grid" aria-label="TIPIC artifact links">
      <li v-for="artifact in artifacts" :key="artifact.url" class="panel tipic-card">
        <h3>{{ artifact.name }}</h3>
        <p class="tipic-url">{{ artifact.url }}</p>
        <a
          class="secondary-link"
          :href="artifact.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`Open ${artifact.name} (opens in a new tab)`"
        >Open artifact <span aria-hidden="true">&#8599;</span></a>
      </li>
    </ul>
  </section>
</template>

<script>
export default {
  name: 'TipicArtifactsView',
  data() {
    return {
      artifacts: [
        { name: 'Site Lookup Tools', url: 'https://tipic.zx.zte.com.cn/api/artifacts/268/file' },
        { name: '2026 Q4 Dashboard', url: 'https://tipic.zx.zte.com.cn/api/artifacts/423/file' },
        { name: 'Celcomdigi ZTE MW Project Dashboard', url: 'https://tipic.zx.zte.com.cn/api/artifacts/151/file' },
        { name: 'CelcomDigi 3rd Party MW TX Project Dashboard', url: 'https://tipic.zx.zte.com.cn/api/artifacts/202/file' }
      ]
    };
  }
};
</script>

<style scoped>
.tipic-artifacts { max-width: 1120px; margin: 0 auto; }
.tipic-artifacts h2 { margin: 0; }
.tipic-intro, .tipic-url { color: var(--text-muted); }
.tipic-access-note {
  margin: 24px 0;
  padding: 20px;
  background: #fff8e8;
  border: 1px solid #e3c37c;
  border-left: 4px solid var(--warning);
  border-radius: var(--radius-md);
}
.tipic-access-note h3 { margin: 0 0 8px; }
.tipic-access-note p { margin: 8px 0 0; }
.tipic-access-note a { color: var(--zte-blue-strong); overflow-wrap: anywhere; }
.tipic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; list-style: none; padding: 0; }
.tipic-card { padding: 24px; display: flex; flex-direction: column; align-items: flex-start; }
.tipic-card h3 { margin: 0; }
.tipic-url { overflow-wrap: anywhere; max-width: 100%; font-size: 0.9rem; }
.tipic-card .secondary-link { margin-top: auto; gap: 8px; }
.tipic-artifacts a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; }
@media (max-width: 700px) { .tipic-grid { grid-template-columns: 1fr; } }
</style>
