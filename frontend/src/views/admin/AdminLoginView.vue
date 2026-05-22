<template>
  <div class="admin-login-page">
    <div class="login-container">
      <header class="portal-topbar login-topbar">
        <div class="portal-topbar-brand">
          <span class="brand-mark">ZTE</span>
          <div>
            <p class="eyebrow">AI WORKER PLATFORM</p>
            <h1>PR Creator</h1>
          </div>
        </div>
        <nav class="portal-topbar-nav" aria-label="Portal navigation">
          <router-link class="nav-link" to="/">Dashboard</router-link>
          <router-link class="nav-link" to="/history">Job History</router-link>
        </nav>
      </header>

      <section class="panel admin-login-card">
        <div class="login-card-header">
          <p class="eyebrow">Admin Portal</p>
          <h2>Admin Login</h2>
        </div>

        <ErrorBanner :message="errorMessage" />

        <div class="login-form">
          <label>
            <span class="field-label">Username</span>
            <input v-model="username" autocomplete="username" :disabled="loading" @keyup.enter="login" />
          </label>
          <label>
            <span class="field-label">Password</span>
            <input v-model="password" type="password" autocomplete="current-password" :disabled="loading" @keyup.enter="login" />
          </label>

          <LoadingButton
            label="Login"
            loading-text="Logging in..."
            :loading="loading"
            :disabled="!username.trim() || !password"
            @click="login"
          />
        </div>

        <router-link class="secondary-link back-link" to="/">Back to User Portal</router-link>
      </section>
    </div>
  </div>
</template>

<script>
import ErrorBanner from '../../components/ErrorBanner.vue';
import LoadingButton from '../../components/LoadingButton.vue';
import { getAdminErrorMessage, loginAdmin } from '../../api/adminApi';
import { isAdminAuthenticated } from '../../services/adminAuthStore';

export default {
  name: 'AdminLoginView',
  components: {
    ErrorBanner,
    LoadingButton
  },
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      errorMessage: ''
    };
  },
  mounted() {
    if (isAdminAuthenticated()) {
      this.$router.replace('/admin/health');
    }
  },
  methods: {
    async login() {
      if (!this.username.trim() || !this.password) return;
      this.loading = true;
      this.errorMessage = '';
      try {
        await loginAdmin({
          username: this.username,
          password: this.password
        });
        this.$router.replace(this.$route.query.redirect || '/admin/health');
      } catch (error) {
        this.errorMessage = getAdminErrorMessage(error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>