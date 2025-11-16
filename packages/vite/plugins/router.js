import VueRouter from 'unplugin-vue-router/vite';

/**
 * 创建路由插件配置
 */
export function createRouterPlugin(options = {}) {
    const { scanViews } = options;

    return VueRouter({
        routesFolder: scanViews ? scanViews() : 'src/views',
        dts: './src/types/typed-router.d.ts',
        extensions: ['.vue'],
        importMode: 'async',
        exclude: ['**/components/**']
    });
}
