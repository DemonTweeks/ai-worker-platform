<template>
  <div class="admin-login-page">
    <section class="panel admin-login-card">
      <p class="eyebrow">Admin Portal</p>
      <h1>Admin Login</h1>
      <ErrorBanner :message="errorMessage" />
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
      <router-link class="secondary-link" to="/">Back to User Portal</router-link>
    </section>
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
      this.$router.replace('/admin/assets');
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
        this.$router.replace(this.$route.query.redirect || '/admin/assets');
      } catch (error) {
        this.errorMessage = getAdminErrorMessage(error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
