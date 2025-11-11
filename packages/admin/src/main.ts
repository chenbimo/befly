import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// 引入全局样式 - 临时禁用以排查路由问题
// import './styles/internal/index.scss';

// 引入路由实例
import { router } from './plugins/router';

const app = createApp(App);

// 安装基础插件
app.use(createPinia());

// 使用路由
app.use(router);

app.mount('#app');
