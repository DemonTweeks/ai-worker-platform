import Vue from 'vue';
import VueRouter from 'vue-router';
import HomeView from './views/HomeView.vue';
import JobHistoryView from './views/JobHistoryView.vue';
import JobDetailView from './views/JobDetailView.vue';

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
  }
];

export default new VueRouter({
  mode: 'history',
  routes
});
