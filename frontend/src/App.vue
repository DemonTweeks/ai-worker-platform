<template>
  <div id="app" class="app-shell">
    <header v-if="showGlobalHeader" class="app-header">
      <div class="brand-block">
        <p class="eyebrow">AI Worker Platform</p>
        <h1>PR Creator</h1>
      </div>
      <nav class="top-nav">
        <router-link to="/">Dashboard</router-link>
        <router-link to="/history">Job History</router-link>
        <router-link to="/admin/login">Admin</router-link>
      </nav>
    </header>
    <main class="page-main">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
  computed: {
    showGlobalHeader() {
      const path = this.$route.path;
      // Hide global header on Home (cockpit has its own topbar)
      if (path === '/') return false;
      // Hide global header on all admin routes (admin pages have their own topbar)
      if (path.startsWith('/admin')) return false;
      // Show on other routes (History, Job Detail, etc.)
      return true;
    }
  }
};
</script>