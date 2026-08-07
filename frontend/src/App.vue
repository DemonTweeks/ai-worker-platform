<template>
  <div id="app" class="app-shell">
    <header
      class="app-header"
      :class="{ 'is-hidden': isHeaderHidden }"
      @focusin="showHeader"
    >
      <div class="brand-block">
        <span class="brand-mark">ZTE</span>
        <div>
          <p class="eyebrow">AI Worker Platform</p>
          <h1>AI Workers</h1>
        </div>
      </div>

      <WorkerNavigation />

      <nav class="top-nav" aria-label="Global navigation">
        <span
          class="nav-health"
          :class="{
            ok: health && health.status === 'ok',
            warning: health && health.status === 'degraded',
            error: healthError || (health && health.status === 'down')
          }"
        >
          {{ healthLabel }}
        </span>
        <router-link
          class="nav-link"
          to="/dashboard"
        >
          Dashboard
        </router-link>
        <router-link class="nav-link" to="/history">History</router-link>
        <router-link class="nav-link" to="/admin/login">Admin</router-link>
      </nav>
    </header>
    <main class="page-main">
      <router-view />
    </main>
  </div>
</template>

<script>
import { getHealth } from './api/jobApi';
import WorkerNavigation from './components/WorkerNavigation.vue';

export default {
  name: 'App',
  components: {
    WorkerNavigation
  },
  data() {
    return {
      health: null,
      healthError: false,
      healthTimer: null,
      isHeaderHidden: false,
      lastScrollY: 0,
      headerScrollFrame: null
    };
  },
  computed: {
    healthLabel() {
      if (this.health && this.health.status === 'ok') return '🟢Healthy';
      if (this.health && this.health.status === 'degraded') return '🟡Degraded';
      if (this.health && this.health.status === 'down') return '🔴Down';
      if (this.healthError) return '⚪Unavailable';
      return '🔵Checking';
    }
  },
  mounted() {
    this.checkHealth();
    this.healthTimer = setInterval(this.checkHealth, 30000);
    this.lastScrollY = Math.max(window.scrollY || 0, 0);
    window.addEventListener('scroll', this.handleHeaderScroll, { passive: true });
  },
  beforeDestroy() {
    window.removeEventListener('scroll', this.handleHeaderScroll);
    if (this.headerScrollFrame !== null) {
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.headerScrollFrame);
      } else {
        window.clearTimeout(this.headerScrollFrame);
      }
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
    }
  },
  methods: {
    handleHeaderScroll() {
      if (this.headerScrollFrame !== null) {
        return;
      }

      const requestFrame = typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 16);
      this.headerScrollFrame = requestFrame(() => {
        const currentScrollY = Math.max(window.scrollY || 0, 0);
        const scrollDelta = currentScrollY - this.lastScrollY;

        if (currentScrollY <= 16) {
          this.isHeaderHidden = false;
          this.lastScrollY = currentScrollY;
        } else if (Math.abs(scrollDelta) >= 6) {
          this.isHeaderHidden = scrollDelta > 0 && currentScrollY > 80;
          this.lastScrollY = currentScrollY;
        }

        this.headerScrollFrame = null;
      });
    },
    showHeader() {
      this.isHeaderHidden = false;
    },
    async checkHealth() {
      try {
        this.health = await getHealth();
        this.healthError = false;
      } catch (error) {
        this.health = null;
        this.healthError = true;
      }
    }
  }
};
</script>
