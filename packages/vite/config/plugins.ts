/**
 * Vite 插件配置
 */
import vue from '@vitejs/plugin-vue';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';
import autoRoutes from 'befly-auto-routes';
import type { Plugin } from 'vite';

/**
 * 插件配置映射
 * 用于支持用户覆盖插件参数
 */
export const pluginConfigs = {
    vue: {},
    reactivityTransform: {},
    autoRoutes: { debug: true },
    icons: {
        compiler: 'vue3',
        autoInstall: true,
        // 默认使用的图标集
        defaultClass: 'icon',
        defaultStyle: 'margin-right: 8px; vertical-align: middle;'
    },
    autoImport: {
        imports: [
            'vue',
            'vue-router',
            'pinia',
            {
                '@opentiny/vue': ['Modal', 'Notify', 'Loading', 'Message']
            }
        ],
        resolvers: [
            TinyVueSingleResolver,
            // 自动导入图标组件
            IconsResolver({
                prefix: 'i', // 前缀：i-lucide:home
                enabledCollections: ['lucide', 'mdi', 'carbon', 'ant-design']
            })
        ],
        dirs: ['./src/plugins/internal', './src/plugins'],
        dts: 'src/types/auto-imports.d.ts',
        eslintrc: {
            enabled: false
        }
    },
    components: {
        resolvers: [
            TinyVueSingleResolver,
            // 自动注册图标组件
            IconsResolver({
                prefix: 'i',
                enabledCollections: ['lucide', 'mdi', 'carbon', 'ant-design']
            })
        ],
        dirs: ['src/components/internal', 'src/components'],
        dts: 'src/types/components.d.ts'
    }
};

/**
 * 创建插件数组
 * @param customConfigs 用户自定义的插件配置
 */
export function createPlugins(customConfigs: Partial<typeof pluginConfigs> = {}): Plugin[] {
    // 合并用户配置和默认配置
    const finalConfigs = {
        vue: { ...pluginConfigs.vue, ...customConfigs.vue },
        reactivityTransform: { ...pluginConfigs.reactivityTransform, ...customConfigs.reactivityTransform },
        autoRoutes: { ...pluginConfigs.autoRoutes, ...customConfigs.autoRoutes },
        icons: { ...pluginConfigs.icons, ...customConfigs.icons },
        autoImport: { ...pluginConfigs.autoImport, ...customConfigs.autoImport },
        components: { ...pluginConfigs.components, ...customConfigs.components }
    };

    return [vue(finalConfigs.vue as any), ReactivityTransform(finalConfigs.reactivityTransform as any), autoRoutes(finalConfigs.autoRoutes as any), Icons(finalConfigs.icons as any), AutoImport(finalConfigs.autoImport as any), Components(finalConfigs.components as any)];
}

/**
 * 默认插件数组
 */
export const plugins = createPlugins();
