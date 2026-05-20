<template>
  <div id="app" class="app-shell">
    <header class="app-header">
      <div class="brand-block">
        <p class="eyebrow">AI Worker Platform</p>
        <h1>PR Worker Console</h1>
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
