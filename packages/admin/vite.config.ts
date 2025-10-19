import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';
import autoRouter from './libs/autoRouter';
import { tinyIcons } from './libs/icons';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // Vue 响应式语法糖
        ReactivityTransform(),
        // 自动路由插件
        autoRouter(),
        // 自动导入 Vue3 API 和组合式函数
        AutoImport({
            imports: [
                'vue',
                'vue-router',
                'pinia',
                // OpenTiny 图标自动导入（全部 533 个图标，配置见 libs/icons.ts）
                {
                    '@opentiny/vue-icon': tinyIcons as any,
                    '@opentiny/vue': ['Modal', 'Notify', 'Loading', 'Message']
                }
            ],
            resolvers: [TinyVueSingleResolver],
            // 自动导入 plugins 目录下的所有导出
            dirs: ['./src/plugins'],
            dts: 'src/types/auto-imports.d.ts',
            eslintrc: {
                enabled: false
            }
        }),
        // 自动导入 OpenTiny 组件
        Components({
            resolvers: [TinyVueSingleResolver],
            dts: 'src/types/components.d.ts'
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    define: {
        'process.env': { TINY_MODE: 'pc' } // OpenTiny 需要的环境变量
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
                additionalData: `@use "@/styles/variables.scss" as *;`
            }
        }
    },
    server: {
        port: 5173,
        host: true,
        open: false
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vue-vendor': ['vue', 'vue-router', 'pinia'],
                    'opentiny-vendor': ['@opentiny/vue']
                }
            }
        }
    }
});
