// 引入 TDesign 组件
import { Table as TTable } from "tdesign-vue-next";
// 引入 TDesign 样式
import "tdesign-vue-next/es/style/index.css";
// 引入 UnoCSS 样式
import "virtual:uno.css";
// 引入 addonAdmin 的 CSS 变量
import "@befly-addon/admin/styles/variables.scss";
// 引入全局基础样式（reset、通用类、滚动条等）
import "@/styles/global.scss";
import App from "./App.vue";
// 引入路由实例
import { router } from "./plugins/router";

const app = createApp(App);

// 安装基础插件
app.use(createPinia());

// 使用路由
app.use(router);

// 全局配置 TTable 默认属性
app.component("TTable", {
    ...TTable,
    props: {
        ...TTable.props,
        bordered: {
            type: [Boolean, Object],
            default: () => ({ cell: "horizontal" })
        },
        size: {
            type: String,
            default: "small"
        },
        height: {
            type: [String, Number],
            default: "100%"
        },
        selectOnRowClick: {
            type: Boolean,
            default: true
        },
        activeRowType: {
            type: String,
            default: "single"
        }
    }
});

app.mount("#app");
