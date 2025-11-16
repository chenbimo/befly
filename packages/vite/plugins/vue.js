import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';

/**
 * 创建 Vue 插件配置
 */
export function createVuePlugins() {
    return [
        vue({
            script: {
                defineModel: true,
                propsDestructure: true
            }
        }),
        ReactivityTransform({
            exclude: []
        })
    ];
}
