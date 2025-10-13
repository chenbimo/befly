import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import App from './App.vue';

// 引入 TDesign 样式
import 'tdesign-vue-next/es/style/index.css';

// 引入全局样式
import './styles/index.css';

// 引入路由实例
import { router } from './plugins/router';

const app = createApp(App);

// 安装基础插件
app.use(createPinia());
app.use(TDesign);

// 使用路由
app.use(router);

app.mount('#app');
