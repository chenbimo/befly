import App from './App.vue';

// 引入全局基础样式（reset、通用类、滚动条等）
import '@/styles/index.scss';

// 引入路由实例
import { router } from './router';

const app = createApp(App);

// 安装基础插件
app.use(createPinia());

// 使用路由
app.use(router);

app.mount('#app');
