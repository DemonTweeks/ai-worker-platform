import Vue from 'vue';
import App from './App.vue';
import router from './router';
import PRCreatorView from './views/PRCreatorView.vue';
import applyRanRetentionRestoreGuard from './patches/ranRetentionRestoreGuard';
import './styles.css';
import './responsive-workbench.css';

applyRanRetentionRestoreGuard(PRCreatorView);

Vue.config.productionTip = false;

new Vue({
  router,
  render: (h) => h(App)
}).$mount('#app');
