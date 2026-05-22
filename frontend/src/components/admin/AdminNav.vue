<template>
  <div class="admin-nav-row panel">
    <div class="admin-nav-brand">
      <span class="brand-mark-small">ZTE</span>
      <span class="admin-nav-label">Admin Portal</span>
    </div>
    <nav class="admin-nav-links">
      <router-link to="/admin/health">Health Dashboard</router-link>
      <router-link to="/admin/assets">Assets</router-link>
      <router-link to="/admin/audit-logs">Audit Logs</router-link>
      <router-link to="/">User Portal</router-link>
    </nav>
    <button type="button" class="secondary-button logout-button" @click="$emit('logout')">Logout</button>
  </div>
</template>

<script>
import { getAdminUser } from '../../services/adminAuthStore';

export default {
  name: 'AdminNav',
  emits: ['logout'],
  computed: {
    adminName() {
      const admin = getAdminUser();
      return admin && admin.username ? admin.username : 'Admin';
    }
  }
};
</script>