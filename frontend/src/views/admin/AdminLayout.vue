<template>
  <div class="admin-shell">
    <AdminNav @logout="logout" />
    <main class="admin-main">
      <ErrorBanner :message="errorMessage" />
      <router-view />
    </main>
  </div>
</template>

<script>
import AdminNav from '../../components/admin/AdminNav.vue';
import ErrorBanner from '../../components/ErrorBanner.vue';
import { getAdminErrorMessage, logoutAdmin } from '../../api/adminApi';

export default {
  name: 'AdminLayout',
  components: {
    AdminNav,
    ErrorBanner
  },
  data() {
    return {
      errorMessage: ''
    };
  },
  mounted() {
    window.addEventListener('admin-unauthorized', this.handleUnauthorized);
  },
  beforeDestroy() {
    window.removeEventListener('admin-unauthorized', this.handleUnauthorized);
  },
  methods: {
    handleUnauthorized() {
      this.errorMessage = 'Admin session expired. Please login again.';
      this.$router.replace('/admin/login');
    },
    async logout() {
      this.errorMessage = '';
      try {
        await logoutAdmin();
      } catch (error) {
        this.errorMessage = getAdminErrorMessage(error);
      } finally {
        this.$router.replace('/admin/login');
      }
    }
  }
};
</script>
