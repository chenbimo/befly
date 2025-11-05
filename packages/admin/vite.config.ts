import { createBeflyConfig } from 'befly-vite';

/**
 * Admin 项目 Vite 配置
 * 使用 createBeflyConfig 自动集成 befly-vite 的默认配置
 *
 * 默认已包含：
 * - Vue 3 + 响应式语法糖
 * - 自动路由（befly-auto-routes）
 * - 自动导入（Vue API、OpenTiny 组件等）
 * - SCSS 支持 + variables.scss 全局注入
 * - 开发服务器配置
 * - 构建优化配置
 *
 * 如需覆盖，直接在下方配置对象中指定即可
 */
export default createBeflyConfig({
    // 示例：覆盖服务器端口
    // server: {
    //     port: 3000
    // },
    // 示例：覆盖插件配置参数
    // pluginConfigs: {
    //     // 覆盖 autoRoutes 的 debug 参数
    //     autoRoutes: {
    //         debug: false
    //     },
    //     // 覆盖 AutoImport 的 dirs 参数
    //     autoImport: {
    //         dirs: ['./src/utils', './src/composables']
    //     }
    // },
    // 示例：追加自定义插件
    // extraPlugins: [
    //     // 你的插件
    // ],
    // 示例：自定义构建输出目录
    // build: {
    //     outDir: 'build'
    // }
});
