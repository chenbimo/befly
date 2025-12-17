import vue from "@vitejs/plugin-vue";

/**
 * 创建 Vue 插件配置
 */
export function createVuePlugin() {
    return vue({
        script: {
            defineModel: true,
            propsDestructure: true
        }
    });
}
