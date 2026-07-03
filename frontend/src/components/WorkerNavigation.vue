<template>
  <nav class="worker-nav" aria-label="Worker navigation">
    <router-link
      v-for="item in items"
      :key="item.id"
      class="nav-link"
      :to="item.to"
      exact
    >
      {{ item.label }}
    </router-link>
  </nav>
</template>

<script>
import workerNavigationItems from '../config/workerNavigation';

export default {
  name: 'WorkerNavigation',
  data() {
    return {
      items: workerNavigationItems
    };
  }
};
</script>
