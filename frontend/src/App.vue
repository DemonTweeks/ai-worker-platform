<template>
  <div id="app" class="app-shell">
    <header class="app-header">
      <div class="brand-block">
        <span class="brand-mark">ZTE</span>
        <div>
          <p class="eyebrow">AI WORKER PLATFORM</p>
          <h1>PR Creator</h1>
        </div>
      </div>
      <nav class="top-nav">
        <router-link class="nav-link" to="/">Dashboard</router-link>
        <router-link class="nav-link" to="/history">Job History</router-link>
        <router-link class="nav-link" to="/admin/login">Admin</router-link>
      </nav>
    </header>
    <main class="page-main">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
};
</script>