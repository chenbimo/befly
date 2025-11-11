import { defineConfig } from 'rolldown-vite';
import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';
import { federation } from '@module-federation/vite';
import autoRoutes from 'befly-auto-routes';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    root: process.cwd(),
    base: './',
    plugins: [
        vue(),
        ReactivityTransform(),
        federation({
            name: 'adminHost',
            remotes: {
                addonAdmin: {
                    type: 'module',
                    name: 'addonAdmin',
                    entry: 'http://localhost:5601/remoteEntry.js',
                    entryGlobalName: 'addonAdmin',
                    shareScope: 'default'
                }
            },
            shared: {
                vue: {
                    singleton: true,
                    requiredVersion: '^3.5.0'
                },
                'vue-router': {
                    singleton: true,
                    requiredVersion: '^4.6.0'
                },
                pinia: {
                    singleton: true,
                    requiredVersion: '^3.0.0'
                },
                '@opentiny/vue': {
                    singleton: true,
                    requiredVersion: '^3.27.0'
                }
            }
        }),
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
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@befly-addon/admin': fileURLToPath(new URL('../addonAdmin', import.meta.url))
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
        include: ['vue', 'vue-router', 'pinia', '@opentiny/vue', 'axios'],
        // 强制预构建 addon 依赖
        entries: ['src/**/*.vue', '../addonAdmin/views/**/*.vue']
    },
    build: {
        target: 'chrome89',
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'esbuild',
        chunkSizeWarningLimit: 1000,
        modulePreload: {
            polyfill: true
        },
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('vue') || id.includes('pinia')) {
                            return 'vue';
                        }
                        if (id.includes('@opentiny/vue')) {
                            return 'opentiny';
                        }
                    }
                }
            }
        }
    }
});
