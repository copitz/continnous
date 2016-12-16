// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import VueMaterial from 'vue-material';

import App from './App';

require('vue-material/dist/vue-material.css');

Vue.use(VueMaterial);
Vue.material.registerTheme('default', {
  primary: 'light-green',
  accent: 'lime',
});

const firebase = require('firebase');

const config = {
  apiKey: 'AIzaSyCy4CP6XOpkZuAeiK4YhZWysu9FD2W4l-8',
  authDomain: 'continnous.firebaseapp.com',
  databaseURL: 'https://continnous.firebaseio.com',
  storageBucket: 'continnous.appspot.com',
  messagingSenderId: '552370645245',
};
firebase.initializeApp(config);

/* eslint-disable no-new */
new Vue({
  el: '#app',
  template: '<App/>',
  components: { App },
});
