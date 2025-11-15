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
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';
import UnoCSS from 'unocss/vite';
import { fileURLToPath, URL } from 'node:url';
import { scanBeflyAddonViews } from '@befly-addon/admin/utils/scanBeflyAddonViews';

export default defineConfig({
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
                    '@opentiny/vue': ['Modal', 'Notify', 'Message', 'MessageBox', 'Loading']
                }
            ],
            dts: 'src/types/auto-imports.d.ts',
            dirs: ['src/utils', 'src/plugins', 'src/config'],
            vueTemplate: true
        }),

        // 组件自动导入
        Components({
            resolvers: [TinyVueSingleResolver, IconsResolver({})],
            dirs: ['src/components'],
            deep: true,
            dts: 'src/types/components.d.ts'
        }),

        // 图标
        Icons({
            compiler: 'vue3',
            autoInstall: true,
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
        rollupOptions: {
            external: ['vue', 'vue-router', 'pinia', '@opentiny/vue', 'axios', 'vue-macros/macros'],
            output: {
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
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
        include: ['vue', 'vue-router', 'pinia', 'axios', '@opentiny/vue']
    }
});
