<template>
  <div id="app">
    <header class="app-header">
      <div>
        <p class="eyebrow">AI Worker Platform</p>
        <h1>PR Worker</h1>
      </div>
      <nav>
        <router-link to="/">Run Job</router-link>
        <router-link to="/history">Job History</router-link>
        <router-link to="/admin/login">Admin</router-link>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>
