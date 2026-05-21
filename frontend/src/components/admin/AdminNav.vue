<template>
  <aside class="admin-nav panel">
    <div class="admin-nav-header">
      <span class="brand-mark-small">ZTE</span>
      <div>
        <p class="eyebrow">Admin Portal</p>
        <h2>{{ adminName }}</h2>
      </div>
    </div>
    <nav>
      <router-link to="/admin/audit-logs">Audit Logs</router-link>
      <router-link to="/admin/health">Health Dashboard</router-link>
      <router-link to="/">User Portal</router-link>
    </nav>
    <button type="button" class="secondary-button logout-button" @click="$emit('logout')">Logout</button>
  </aside>
</template>

<script>
import { getAdminUser } from '../../services/adminAuthStore';

export default {
  name: 'AdminNav',
  computed: {
    adminName() {
      const admin = getAdminUser();
      return admin && admin.username ? admin.username : 'Admin';
    }
  }
};
</script>