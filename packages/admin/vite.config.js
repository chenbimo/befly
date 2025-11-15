import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueRouter from 'unplugin-vue-router/vite';
import { VueRouterAutoImports } from 'unplugin-vue-router';
import VueDevTools from 'vite-plugin-vue-devtools';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import UnoCSS from 'unocss/vite';
import { fileURLToPath, URL } from 'node:url';
import { scanBeflyAddonViews } from '@befly-addon/admin/utils/scanBeflyAddonViews';

export default defineConfig({
    // 基础路径配置（支持二级目录部署）
    base: './',

    // 插件配置
    plugins: [
        // UnoCSS
        UnoCSS(),

        // Vue DevTools（仅开发环境）
        VueDevTools(),

        // VueRouter 必须在 Vue 插件之前
        VueRouter({
            routesFolder: scanBeflyAddonViews(),
            dts: './src/types/typed-router.d.ts',
            extensions: ['.vue'],
            importMode: 'async',
            // 全局排除 components 目录
            exclude: ['**/components/**']
        }),

        // Vue 插件
        vue({
            script: {
                defineModel: true,
                propsDestructure: true
            }
        }),

        // Vue Reactivity Transform 支持
        ReactivityTransform(),

        // API 自动导入
        AutoImport({
            imports: [
                'vue',
                'pinia',
                VueRouterAutoImports,
                {
                    '@opentiny/vue-modal': [
                        ['default', 'Modal'],
                        ['default', 'MessageBox']
                    ],
                    '@opentiny/vue-notify': [['default', 'Notify']],
                    '@opentiny/vue-message': [['default', 'Message']],
                    '@opentiny/vue-loading': [['default', 'Loading']]
                }
            ],
            dts: 'src/types/auto-imports.d.ts',
            dirs: ['src/utils', 'src/plugins', 'src/config'],
            vueTemplate: true
        }),

        // 组件自动导入
        Components({
            resolvers: [IconsResolver({})],
            dirs: ['src/components'],
            deep: true,
            dts: 'src/types/components.d.ts'
        }),

        // 图标
        Icons({
            compiler: 'vue3',
            autoInstall: false,
            defaultClass: 'icon-befly',
            defaultStyle: 'margin-right: 8px; vertical-align: middle;'
        })
    ],

    // 路径别名
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },

    // 服务器配置
    server: {
        port: 5600,
        host: '0.0.0.0',
        strictPort: true,
        open: false,
        hmr: true
    },

    // 构建配置
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
                manualChunks: (id) => {
                    // Vue 核心框架（独立文件）
                    if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) {
                        return 'framework-vue';
                    }
                    if (id.includes('node_modules/vue-router/')) {
                        return 'framework-vue-router';
                    }
                    if (id.includes('node_modules/pinia/')) {
                        return 'framework-pinia';
                    }

                    // TinyVue 细粒度拆分
                    if (id.includes('@opentiny/vue-renderless/src/grid')) {
                        return 'tiny-grid';
                    }
                    if (id.includes('@opentiny/vue-renderless/src/table')) {
                        return 'tiny-table';
                    }
                    if (id.includes('@opentiny/vue-renderless/src/tree')) {
                        return 'tiny-tree';
                    }
                    if (id.includes('@opentiny/vue-renderless/src/form')) {
                        return 'tiny-form';
                    }
                    if (id.includes('node_modules/@opentiny/vue-renderless/')) {
                        return 'tiny-renderless';
                    }
                    if (id.includes('node_modules/@opentiny/vue-theme/')) {
                        return 'tiny-theme';
                    }
                    if (id.includes('node_modules/@opentiny/vue-locale/')) {
                        return 'tiny-locale';
                    }
                    if (id.includes('node_modules/@opentiny/vue-common/')) {
                        return 'tiny-common';
                    }
                    if (id.includes('node_modules/@opentiny/vue-icon/')) {
                        return 'tiny-icon';
                    }

                    // 工具库（独立文件）
                    if (id.includes('node_modules/axios/')) {
                        return 'lib-axios';
                    }

                    // lodash-es 独立拆分（体积较大）
                    if (id.includes('node_modules/lodash-es/') || id.includes('node_modules/.bun/lodash-es')) {
                        return 'lib-lodash';
                    }

                    // echarts 及相关库（TinyVue 图表组件依赖）
                    if (id.includes('node_modules/echarts/') || id.includes('node_modules/.bun/echarts')) {
                        return 'lib-echarts';
                    }
                    if (id.includes('node_modules/zrender/') || id.includes('node_modules/.bun/zrender')) {
                        return 'lib-zrender';
                    }

                    // Lucide 图标
                    if (id.includes('node_modules/@iconify/') || id.includes('~icons/')) {
                        return 'icons';
                    }

                    // Vue Macros
                    if (id.includes('node_modules/@vue-macros/') || id.includes('node_modules/vue-macros/')) {
                        return 'vue-macros';
                    }

                    // befly-addon
                    if (id.includes('@befly-addon/')) {
                        return 'befly-addon';
                    }

                    // 其他 node_modules 依赖
                    if (id.includes('node_modules/')) {
                        return 'vendor';
                    }
                }
            }
        }
    },

    // CSS 配置
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
                // 自动导入全局 SCSS 变量
                additionalData: `@use "@/styles/variables.scss" as *;`
            }
        }
    },

    // 优化配置
    optimizeDeps: {
        include: [
            // Vue 核心框架
            'vue',
            'vue-router',
            'pinia',
            'axios',
            'vue-macros/macros',
            // TinyVue 组件（只包含实际使用的组件）
            '@opentiny/vue-button',
            '@opentiny/vue-dialog-box',
            '@opentiny/vue-dropdown',
            '@opentiny/vue-dropdown-item',
            '@opentiny/vue-dropdown-menu',
            '@opentiny/vue-form',
            '@opentiny/vue-form-item',
            '@opentiny/vue-grid',
            '@opentiny/vue-grid-column',
            '@opentiny/vue-icon',
            '@opentiny/vue-input',
            '@opentiny/vue-modal',
            '@opentiny/vue-numeric',
            '@opentiny/vue-pager',
            '@opentiny/vue-radio',
            '@opentiny/vue-radio-group',
            '@opentiny/vue-select',
            '@opentiny/vue-tag',
            '@opentiny/vue-tree'
        ]
    }
});
