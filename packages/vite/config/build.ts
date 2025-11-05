/**
 * Vite 构建配置
 */
export const build = {
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
};
