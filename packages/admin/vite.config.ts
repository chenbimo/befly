import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';
import autoRoutes from 'befly-auto-routes';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    root: process.cwd(),
    base: './',
    plugins: [
        vue(),
        ReactivityTransform(),
        autoRoutes({ debug: true }),
        Icons({
            compiler: 'vue3',
            autoInstall: true,
            defaultClass: 'icon-befly',
            defaultStyle: 'margin-right: 8px; vertical-align: middle;'
        }),
        AutoImport({
            imports: [
                'vue',
                'vue-router',
                'pinia',
                {
                    '@opentiny/vue': ['Modal', 'Notify', 'Loading', 'Message']
                }
            ],
            resolvers: [TinyVueSingleResolver, IconsResolver({})],
            vueTemplate: true,
            dirsScanOptions: {
                filePatterns: ['*.ts'],
                fileFilter: (file) => file.endsWith('.ts'),
                types: true
            },
            dirs: ['./src/plugins/**', './src/config/**'],
            dts: 'src/types/auto-imports.d.ts',
            eslintrc: { enabled: false }
        }),
        Components({
            resolvers: [TinyVueSingleResolver, IconsResolver({})],
            dirs: ['src/components'],
            deep: true,
            version: 3,
            dts: 'src/types/components.d.ts'
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `@use "@/styles/internal/variables.scss" as *;`,
                api: 'modern-compiler'
            }
        }
    },
    server: {
        host: '0.0.0.0',
        port: 5600,
        strictPort: true,
        open: false
    },
    logLevel: 'info',
    optimizeDeps: {
        include: ['vue', 'vue-router', 'pinia', '@opentiny/vue', 'axios']
    },
    build: {
        target: 'esnext',
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'esbuild',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    vue: ['vue', 'vue-router', 'pinia'],
                    opentiny: ['@opentiny/vue']
                }
            }
        }
    }
});
