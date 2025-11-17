import Icons from 'unplugin-icons/vite';

/**
 * 创建图标插件配置
 */
export function createIconsPlugin() {
    return Icons({
        compiler: 'vue3',
        autoInstall: false,
        defaultClass: 'icon-befly',
        defaultStyle: 'vertical-align: middle;'
    });
}
