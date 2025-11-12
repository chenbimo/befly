import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueRouter from 'unplugin-vue-router/vite';
import { VueRouterAutoImports } from 'unplugin-vue-router';
import Layouts from 'vite-plugin-vue-layouts-next';
import VueDevTools from 'vite-plugin-vue-devtools';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import ReactivityTransform from '@vue-macros/reactivity-transform/vite';
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';
import UnoCSS from 'unocss/vite';
import { fileURLToPath, URL } from 'node:url';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// 动态扫描所有 @befly-addon 包的 views 目录
function scanBeflyAddonViews() {
    const addonBasePath = 'node_modules/@befly-addon';
    const routesFolders: any[] = [];

    if (!existsSync(addonBasePath)) {
        return routesFolders;
    }

    try {
        const addonDirs = readdirSync(addonBasePath);

        for (const addonName of addonDirs) {
            const addonPath = join(addonBasePath, addonName);

            // 检查是否为目录（包括符号链接）
            if (!existsSync(addonPath)) continue;

            const viewsPath = join(addonPath, 'views');

            if (existsSync(viewsPath)) {
                routesFolders.push({
                    src: viewsPath,
                    path: `addon/${addonName}/`
                });
            }
        }
    } catch (error) {
        console.error('扫描 @befly-addon 目录失败:', error);
    }

    return routesFolders;
}

const routesFolders = scanBeflyAddonViews();

export default defineConfig({
    // 插件配置
    plugins: [
        // UnoCSS
        UnoCSS(),

        // Vue DevTools（仅开发环境）
        // VueDevTools(),

        // VueRouter 必须在 Vue 插件之前
        VueRouter({
            routesFolder: routesFolders,
            dts: './src/types/typed-router.d.ts',
            extensions: ['.vue'],
            importMode: 'async',
            // 全局排除 components 目录
            exclude: ['**/components/**']
        }),

        // 布局系统
        Layouts({
            layoutsDirs: 'src/layouts',
            defaultLayout: 'default'
        }),

        // Vue 插件
        vue({
            script: {
                defineModel: true,
                propsDestructure: true
            }
        }),

        // Vue Reactivity Transform 支持
        ReactivityTransform(),

        // API 自动导入
        AutoImport({
            imports: [
                'vue',
                'pinia',
                VueRouterAutoImports,
                {
                    '@opentiny/vue': ['Modal', 'Notify', 'Message', 'MessageBox', 'Loading']
                }
            ],
            dts: 'src/types/auto-imports.d.ts',
            dirs: ['src/utils', 'src/plugins', 'src/config'],
            vueTemplate: true
        }),

        // 组件自动导入
        Components({
            resolvers: [TinyVueSingleResolver, IconsResolver({})],
            dirs: ['src/components'],
            deep: true,
            dts: 'src/types/components.d.ts'
        }),

        // 图标
        Icons({
            compiler: 'vue3',
            autoInstall: true,
            defaultClass: 'icon-befly',
            defaultStyle: 'margin-right: 8px; vertical-align: middle;'
        })
    ],

    // 路径别名
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },

    // 服务器配置
    server: {
        port: 5600,
        host: '0.0.0.0',
        strictPort: true,
        open: false,
        hmr: true
    },

    // 构建配置
    build: {
        target: 'es2020',
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
            output: {
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]',
                manualChunks: {
                    vue: ['vue', 'vue-router', 'pinia'],
                    opentiny: ['@opentiny/vue']
                }
            }
        }
    },

    // CSS 配置
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
                // 自动导入全局 SCSS 变量
                additionalData: `@use "@/styles/variables.scss" as *;`
            }
        }
    },

    // 定义全局变量
    define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
    },

    // 优化依赖预构建
    optimizeDeps: {
        include: [
            'vue',
            'vue-router',
            'pinia',
            'axios',
            // OpenTiny Vue 所有组件
            '@opentiny/vue',
            '@opentiny/vue-action-menu',
            '@opentiny/vue-action-sheet',
            '@opentiny/vue-alert',
            '@opentiny/vue-amount',
            '@opentiny/vue-anchor',
            '@opentiny/vue-area',
            '@opentiny/vue-async-flowchart',
            '@opentiny/vue-autocomplete',
            '@opentiny/vue-badge',
            '@opentiny/vue-base-select',
            '@opentiny/vue-breadcrumb',
            '@opentiny/vue-breadcrumb-item',
            '@opentiny/vue-bulletin-board',
            '@opentiny/vue-button',
            '@opentiny/vue-button-group',
            '@opentiny/vue-calendar',
            '@opentiny/vue-calendar-bar',
            '@opentiny/vue-calendar-view',
            '@opentiny/vue-card',
            '@opentiny/vue-card-group',
            '@opentiny/vue-card-template',
            '@opentiny/vue-carousel',
            '@opentiny/vue-carousel-item',
            '@opentiny/vue-cascader',
            '@opentiny/vue-cascader-menu',
            '@opentiny/vue-cascader-mobile',
            '@opentiny/vue-cascader-node',
            '@opentiny/vue-cascader-panel',
            '@opentiny/vue-cascader-select',
            '@opentiny/vue-cascader-view',
            '@opentiny/vue-cell',
            '@opentiny/vue-checkbox',
            '@opentiny/vue-checkbox-button',
            '@opentiny/vue-checkbox-group',
            '@opentiny/vue-col',
            '@opentiny/vue-collapse',
            '@opentiny/vue-collapse-item',
            '@opentiny/vue-collapse-transition',
            '@opentiny/vue-color-picker',
            '@opentiny/vue-color-select-panel',
            '@opentiny/vue-column-list-group',
            '@opentiny/vue-column-list-item',
            '@opentiny/vue-company',
            '@opentiny/vue-config-provider',
            '@opentiny/vue-container',
            '@opentiny/vue-country',
            '@opentiny/vue-crop',
            '@opentiny/vue-currency',
            '@opentiny/vue-date-panel',
            '@opentiny/vue-date-picker',
            '@opentiny/vue-date-picker-mobile-first',
            '@opentiny/vue-date-range',
            '@opentiny/vue-date-table',
            '@opentiny/vue-dept',
            '@opentiny/vue-dialog-box',
            '@opentiny/vue-dialog-select',
            '@opentiny/vue-divider',
            '@opentiny/vue-drawer',
            '@opentiny/vue-drop-roles',
            '@opentiny/vue-drop-times',
            '@opentiny/vue-dropdown',
            '@opentiny/vue-dropdown-item',
            '@opentiny/vue-dropdown-menu',
            '@opentiny/vue-dynamic-scroller',
            '@opentiny/vue-dynamic-scroller-item',
            '@opentiny/vue-espace',
            '@opentiny/vue-exception',
            '@opentiny/vue-fall-menu',
            '@opentiny/vue-file-upload',
            '@opentiny/vue-filter',
            '@opentiny/vue-filter-bar',
            '@opentiny/vue-filter-box',
            '@opentiny/vue-filter-panel',
            '@opentiny/vue-float-button',
            '@opentiny/vue-floatbar',
            '@opentiny/vue-floating-button',
            '@opentiny/vue-flowchart',
            '@opentiny/vue-fluent-editor',
            '@opentiny/vue-form',
            '@opentiny/vue-form-item',
            '@opentiny/vue-fullscreen',
            '@opentiny/vue-grid',
            '@opentiny/vue-grid-column',
            '@opentiny/vue-grid-manager',
            '@opentiny/vue-grid-select',
            '@opentiny/vue-grid-toolbar',
            '@opentiny/vue-guide',
            '@opentiny/vue-hrapprover',
            '@opentiny/vue-image',
            '@opentiny/vue-image-viewer',
            '@opentiny/vue-input',
            '@opentiny/vue-ip-address',
            '@opentiny/vue-layout',
            '@opentiny/vue-link',
            '@opentiny/vue-link-menu',
            '@opentiny/vue-load-list',
            '@opentiny/vue-loading',
            '@opentiny/vue-locales',
            '@opentiny/vue-logon-user',
            '@opentiny/vue-logout',
            '@opentiny/vue-menu',
            '@opentiny/vue-message',
            '@opentiny/vue-milestone',
            '@opentiny/vue-mind-map',
            '@opentiny/vue-modal',
            '@opentiny/vue-month-range',
            '@opentiny/vue-month-table',
            '@opentiny/vue-nav-menu',
            '@opentiny/vue-notify',
            '@opentiny/vue-number-animation',
            '@opentiny/vue-numeric',
            '@opentiny/vue-option',
            '@opentiny/vue-option-group',
            '@opentiny/vue-pager',
            '@opentiny/vue-pager-item',
            '@opentiny/vue-panel',
            '@opentiny/vue-picker',
            '@opentiny/vue-pop-upload',
            '@opentiny/vue-popconfirm',
            '@opentiny/vue-popeditor',
            '@opentiny/vue-popover',
            '@opentiny/vue-popup',
            '@opentiny/vue-progress',
            '@opentiny/vue-pull-refresh',
            '@opentiny/vue-qr-code',
            '@opentiny/vue-quarter-panel',
            '@opentiny/vue-query-builder',
            '@opentiny/vue-radio',
            '@opentiny/vue-radio-button',
            '@opentiny/vue-radio-group',
            '@opentiny/vue-rate',
            '@opentiny/vue-record',
            '@opentiny/vue-recycle-scroller',
            '@opentiny/vue-river',
            '@opentiny/vue-roles',
            '@opentiny/vue-row',
            '@opentiny/vue-scroll-text',
            '@opentiny/vue-scrollbar',
            '@opentiny/vue-search',
            '@opentiny/vue-select',
            '@opentiny/vue-select-dropdown',
            '@opentiny/vue-select-mobile',
            '@opentiny/vue-select-view',
            '@opentiny/vue-selected-box',
            '@opentiny/vue-signature',
            '@opentiny/vue-skeleton',
            '@opentiny/vue-skeleton-item',
            '@opentiny/vue-slider',
            '@opentiny/vue-slider-button',
            '@opentiny/vue-slider-button-group',
            '@opentiny/vue-space',
            '@opentiny/vue-split',
            '@opentiny/vue-standard-list-item',
            '@opentiny/vue-statistic',
            '@opentiny/vue-steps',
            '@opentiny/vue-sticky',
            '@opentiny/vue-switch',
            '@opentiny/vue-tab-item',
            '@opentiny/vue-tabbar',
            '@opentiny/vue-tabbar-item',
            '@opentiny/vue-table',
            '@opentiny/vue-tabs',
            '@opentiny/vue-tag',
            '@opentiny/vue-tag-group',
            '@opentiny/vue-text-popup',
            '@opentiny/vue-time',
            '@opentiny/vue-time-line',
            '@opentiny/vue-time-panel',
            '@opentiny/vue-time-picker',
            '@opentiny/vue-time-picker-mobile',
            '@opentiny/vue-time-range',
            '@opentiny/vue-time-select',
            '@opentiny/vue-time-spinner',
            '@opentiny/vue-timeline-item',
            '@opentiny/vue-toggle-menu',
            '@opentiny/vue-tooltip',
            '@opentiny/vue-top-box',
            '@opentiny/vue-transfer',
            '@opentiny/vue-transfer-panel',
            '@opentiny/vue-tree',
            '@opentiny/vue-tree-menu',
            '@opentiny/vue-tree-select',
            '@opentiny/vue-upload',
            '@opentiny/vue-upload-dragger',
            '@opentiny/vue-upload-list',
            '@opentiny/vue-user',
            '@opentiny/vue-user-account',
            '@opentiny/vue-user-contact',
            '@opentiny/vue-user-head',
            '@opentiny/vue-user-head-group',
            '@opentiny/vue-user-link',
            '@opentiny/vue-virtual-scroll-box',
            '@opentiny/vue-virtual-tree',
            '@opentiny/vue-watermark',
            '@opentiny/vue-wizard',
            '@opentiny/vue-year-range',
            '@opentiny/vue-year-table'
        ]
    }
});
