/**
 * Vite 依赖优化配置
 */
export const optimizeDeps = {
    include: ['vue', 'vue-router', 'pinia', 'lucide-vue-next', 'axios', '@opentiny/vue'],
    exclude: [],
    noDiscovery: true,
    force: false,
    esbuildOptions: {
        target: 'esnext'
    }
};
