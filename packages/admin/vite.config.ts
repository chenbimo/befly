import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // 自动导入 Vue3 API 和组合式函数
        AutoImport({
            imports: [
                'vue',
                'vue-router',
                'pinia',
                {
                    'tdesign-vue-next': ['MessagePlugin', 'DialogPlugin', 'NotifyPlugin', 'LoadingPlugin']
                }
            ],
            dts: 'src/types/auto-imports.d.ts',
            eslintrc: {
                enabled: false
            }
        }),
        // 自动导入 TDesign 组件
        Components({
            resolvers: [
                TDesignResolver({
                    library: 'vue-next'
                })
            ],
            dts: 'src/types/components.d.ts'
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
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
    server: {
        port: 5173,
        host: true,
        open: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vue-vendor': ['vue', 'vue-router', 'pinia'],
                    'tdesign-vendor': ['tdesign-vue-next', 'tdesign-icons-vue-next']
                }
            }
        }
    }
});
