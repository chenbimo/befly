import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import App from './App.vue';

// 引入 TDesign 样式
import 'tdesign-vue-next/es/style/index.css';

// 引入全局样式
import './styles/index.css';

const app = createApp(App);

// 安装基础插件
app.use(createPinia());
app.use(TDesign);

// 自动导入的路由插件（来自 src/plugins/router.ts）
// 无需手动导入，unplugin-auto-import 会自动处理
app.use(RouterPlugin);

app.mount('#app');
