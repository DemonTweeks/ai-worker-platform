import Vue from 'vue';
import VueRouter from 'vue-router';
import HomeView from './views/HomeView.vue';
import JobHistoryView from './views/JobHistoryView.vue';
import JobDetailView from './views/JobDetailView.vue';
import AdminLoginView from './views/admin/AdminLoginView.vue';
import AdminLayout from './views/admin/AdminLayout.vue';
import AdminAssetsView from './views/admin/AdminAssetsView.vue';
import AdminAuditLogsView from './views/admin/AdminAuditLogsView.vue';
import AdminHealthView from './views/admin/AdminHealthView.vue';
import { isAdminAuthenticated } from './services/adminAuthStore';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/history',
    name: 'job-history',
    component: JobHistoryView
  },
  {
    path: '/jobs/:jobId',
    name: 'job-detail',
    component: JobDetailView,
    props: true
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: AdminLoginView
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAdmin: true },
    redirect: '/admin/assets',
    children: [
      {
        path: 'assets',
        name: 'admin-assets',
        component: AdminAssetsView
      },
      {
        path: 'audit-logs',
        name: 'admin-audit-logs',
        component: AdminAuditLogsView
      },
      {
        path: 'health',
        name: 'admin-health',
        component: AdminHealthView
      }
    ]
  }
];

const router = new VueRouter({
  mode: 'history',
  routes
});

router.beforeEach((to, from, next) => {
  if (to.matched.some((record) => record.meta.requiresAdmin) && !isAdminAuthenticated()) {
    next({ name: 'admin-login', query: { redirect: to.fullPath } });
    return;
  }

  if (to.name === 'admin-login' && isAdminAuthenticated()) {
    next('/admin/assets');
    return;
  }

  next();
});

export default router;
