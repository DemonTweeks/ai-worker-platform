import Vue from 'vue';
import App from './App.vue';
import router from './router';
import './styles.css';
import './responsive-workbench.css';
import './active-jobs-no-scroll.css';

Vue.config.productionTip = false;

new Vue({
  router,
  render: (h) => h(App)
}).$mount('#app');
