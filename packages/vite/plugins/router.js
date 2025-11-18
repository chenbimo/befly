import VueRouter from 'unplugin-vue-router/vite';
import { scanBeflyViews } from '../utils/scanBeflyViews.js';

/**
 * 创建路由插件配置
 */
export function createRouterPlugin(options = {}) {
    const { scanViews = scanBeflyViews } = options;

    return VueRouter({
        routesFolder: scanViews(),
        dts: './src/types/typed-router.d.ts',
        extensions: ['.vue'],
        importMode: 'async',
        exclude: ['**/components/**']
    });
}
