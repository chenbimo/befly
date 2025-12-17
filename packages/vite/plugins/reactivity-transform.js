import ReactivityTransform from "@vue-macros/reactivity-transform/vite";

// 创建 Vue Reactivity Transform 插件配置
export function createReactivityTransformPlugin() {
    return ReactivityTransform({
        exclude: []
    });
}
