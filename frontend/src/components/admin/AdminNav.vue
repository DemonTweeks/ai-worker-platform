<template>
  <aside class="admin-nav panel">
    <div>
      <p class="eyebrow">Admin Portal</p>
      <h2>{{ adminName }}</h2>
    </div>
    <nav>
      <router-link to="/admin/assets">Assets</router-link>
      <router-link to="/admin/audit-logs">Audit Logs</router-link>
      <router-link to="/admin/health">Health Dashboard</router-link>
      <router-link to="/">User Portal</router-link>
    </nav>
    <button type="button" class="secondary-button" @click="$emit('logout')">Logout</button>
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
