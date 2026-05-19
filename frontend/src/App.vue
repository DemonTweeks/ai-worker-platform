<template>
  <div id="app">
    <header class="app-header">
      <div>
        <p class="eyebrow">AI Worker Platform</p>
        <h1>PR Worker</h1>
      </div>
      <nav>
        <router-link to="/">Run Job</router-link>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>
