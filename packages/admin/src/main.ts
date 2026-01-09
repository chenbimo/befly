// 引入 TDesign 样式
import "tdesign-vue-next/es/style/index.css";
// 引入 addonAdmin 的 CSS 变量
import "@befly-addon/admin/styles/variables.scss";
// 引入全局基础样式（reset、通用类、滚动条等）
import "./styles/global.scss";
import App from "./App.vue";

const app = createApp(App);

// 安装基础插件
app.use(createPinia());

// 使用路由
app.use($Router);

app.mount("#app");
