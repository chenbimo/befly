import { defineConfig, mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { createVuePlugins } from './plugins/vue.js';
import { createRouterPlugin } from './plugins/router.js';
import { createAutoImportPlugin } from './plugins/auto-import.js';
import { createComponentsPlugin } from './plugins/components.js';
import { createIconsPlugin } from './plugins/icons.js';
import { createUnoCSSPlugin } from './plugins/unocss.js';
import { createDevToolsPlugin } from './plugins/devtools.js';
import { createAnalyzerPlugin } from './plugins/analyzer.js';
import { createCompressionPlugin } from './plugins/compression.js';
import { createInspectPlugin } from './plugins/inspect.js';

/**
 * 默认分包策略
 */
function defaultManualChunks(id) {
    // Vue 核心框架
    if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) {
        return 'framework-vue';
    }
    if (id.includes('node_modules/vue-router/')) {
        return 'framework-vue-router';
    }
    if (id.includes('node_modules/pinia/')) {
        return 'framework-pinia';
    }

    // TDesign Vue Next
    if (id.includes('node_modules/tdesign-vue-next/') || id.includes('node_modules/.bun/tdesign-vue-next')) {
        return 'tdesign';
    }

    // 工具库
    if (id.includes('node_modules/axios/')) {
        return 'lib-axios';
    }
    if (id.includes('node_modules/lodash-es/') || id.includes('node_modules/.bun/lodash-es')) {
        return 'lib-lodash';
    }

    // echarts
    if (id.includes('node_modules/echarts/') || id.includes('node_modules/.bun/echarts')) {
        return 'lib-echarts';
    }
    if (id.includes('node_modules/zrender/') || id.includes('node_modules/.bun/zrender')) {
        return 'lib-zrender';
    }

    // 图标
    if (id.includes('node_modules/@iconify/') || id.includes('~icons/')) {
        return 'icons';
    }

    // Vue Macros
    if (id.includes('node_modules/@vue-macros/') || id.includes('node_modules/vue-macros/')) {
        return 'vue-macros';
    }

    // befly-addon
    if (id.includes('@befly-addon/') || id.includes('packages/addonAdmin/') || id.includes('packages\\addonAdmin\\')) {
        return 'befly-addon';
    }

    // 其他 node_modules 依赖
    if (id.includes('node_modules/')) {
        return 'vendor';
    }
}

/**
 * 创建 Befly Vite 配置
 * @param {Object} options - 配置选项
 * @param {string} options.root - 项目根目录（可选）
 * @param {Function} options.scanViews - 扫描视图函数（可选）
 * @param {Object} options.resolvers - 自定义 resolvers（可选）
 * @param {Function} options.manualChunks - 自定义分包配置（可选）
 * @param {Object} options.userConfig - 用户自定义配置（可选）
 * @returns {Object} Vite 配置对象
 */
export function createBeflyViteConfig(options = {}) {
    const { root, scanViews, resolvers = {}, manualChunks, userConfig = {} } = options;

    // 计算根目录（如果未提供）
    const projectRoot = root || process.cwd();

    const baseConfig = defineConfig({
        base: './',

        plugins: [
            //
            createUnoCSSPlugin(),
            createDevToolsPlugin(),
            createRouterPlugin({ scanViews: scanViews }),
            ...createVuePlugins(),
            createAutoImportPlugin({ resolvers: resolvers }),
            createComponentsPlugin({ resolvers: resolvers }),
            createIconsPlugin(),
            createAnalyzerPlugin(),
            createInspectPlugin(),
            createCompressionPlugin()
        ],

        resolve: {
            alias: {
                '@': fileURLToPath(new URL('src', `file:///${projectRoot.replace(/\\/g, '/')}/`))
            }
        },

        server: {
            open: false,
            hmr: true
        },

        build: {
            target: 'es2020',
            outDir: 'dist',
            assetsDir: 'assets',
            sourcemap: false,
            minify: 'esbuild',
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    chunkFileNames: 'assets/js/[name]-[hash].js',
                    entryFileNames: 'assets/js/[name]-[hash].js',
                    assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
                    manualChunks: manualChunks || defaultManualChunks
                }
            }
        },

        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler',
                    additionalData: `@use "@/styles/variables.scss" as *;`
                }
            }
        },

        optimizeDeps: {
            include: ['vue', 'vue-router', 'pinia', 'axios', 'tdesign-vue-next']
        }
    });

    return mergeConfig(baseConfig, userConfig);
}

// 导出 UnoCSS 配置创建函数
export { createUnoConfig } from './configs/uno.config.js';

// 导出工具函数
export { scanBeflyAddonViews } from './utils/scanBeflyAddonViews.js';

// 导出所有插件创建函数（供高级用户自定义）
export { createVuePlugins } from './plugins/vue.js';
export { createRouterPlugin } from './plugins/router.js';
export { createAutoImportPlugin } from './plugins/auto-import.js';
export { createComponentsPlugin } from './plugins/components.js';
export { createIconsPlugin } from './plugins/icons.js';
export { createUnoCSSPlugin } from './plugins/unocss.js';
export { createDevToolsPlugin } from './plugins/devtools.js';
export { createAnalyzerPlugin } from './plugins/analyzer.js';
export { createCompressionPlugin } from './plugins/compression.js';
export { createInspectPlugin } from './plugins/inspect.js';
