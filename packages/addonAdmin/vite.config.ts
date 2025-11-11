import { defineConfig } from 'rolldown-vite';
import vue from '@vitejs/plugin-vue';
import { federation } from '@module-federation/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    plugins: [
        vue(),
        federation({
            name: 'addonAdmin',
            filename: 'remoteEntry.js',
            exposes: {
                './index': './index.ts'
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
        })
    ],
    build: {
        target: 'chrome89',
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
    },
    server: {
        port: 5601,
        origin: 'http://localhost:5601'
    }
});
