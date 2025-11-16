import VueDevTools from 'vite-plugin-vue-devtools';

/**
 * 创建 Vue DevTools 插件配置（仅开发环境）
 */
export function createDevToolsPlugin() {
    return VueDevTools();
}
