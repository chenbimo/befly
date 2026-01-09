import type { Component } from "vue";

// 引入 TDesign 样式
import "tdesign-vue-next/es/style/index.css";
// 引入 addonAdmin 的 CSS 变量
import "@befly-addon/admin/styles/variables.scss";
// 引入全局基础样式（reset、通用类、滚动条等）
import "./styles/global.scss";
// 引入 TDesign 组件
import { Table as TTable } from "tdesign-vue-next";

import App from "./App.vue";

const app = createApp(App);

// 安装基础插件
app.use(createPinia());

// 使用路由
app.use($Router);

// 全局配置 TTable 默认属性
const tableComponent = {
    ...(TTable as unknown as Record<string, unknown>),
    props: {
        ...((TTable as unknown as { props?: Record<string, unknown> }).props ?? {}),
        bordered: {
            type: [Boolean, Object],
            default: () => ({
                cell: "horizontal"
            })
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
} as unknown as Component;

app.component("TTable", tableComponent);

app.mount("#app");
