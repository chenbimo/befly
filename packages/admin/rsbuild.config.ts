import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';
import { pluginSass } from '@rsbuild/plugin-sass';
import VueRouter from 'unplugin-vue-router/webpack';
import { VueRouterAutoImports } from 'unplugin-vue-router';
import AutoImport from 'unplugin-auto-import/rspack';
import Components from 'unplugin-vue-components/rspack';
import Icons from 'unplugin-icons/rspack';
import IconsResolver from 'unplugin-icons/resolver';
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';

export default defineConfig({
    // Vue 插件
    plugins: [pluginVue(), pluginSass()],

    // 源码配置
    source: {
        // 入口文件
        entry: {
            index: './src/main.ts'
        },
        // 包含需要编译的 node_modules 包（关键配置）
        include: [
            // 包含 @befly-addon 包，使其被正常编译
            /node_modules\/@befly-addon\//
        ],
        // 路径别名
        alias: {
            '@': './src'
        },
        // 定义全局变量
        define: {
            __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
        }
    },

    // HTML 配置
    html: {
        template: './index.html'
    },

    // 服务器配置
    server: {
        port: 5600,
        host: '0.0.0.0',
        strictPort: true,
        open: false
    },

    // 开发配置
    dev: {
        hmr: true,
        liveReload: true
    },

    // 构建配置
    output: {
        target: 'web',
        distPath: {
            root: 'dist',
            js: 'assets',
            css: 'assets'
        },
        cleanDistPath: true,
        sourceMap: {
            js: false,
            css: false
        }
    },

    // 性能配置
    performance: {
        chunkSplit: {
            strategy: 'split-by-experience',
            override: {
                chunks: 'all',
                cacheGroups: {
                    vue: {
                        test: /[\\/]node_modules[\\/](vue|vue-router|pinia)[\\/]/,
                        name: 'vue',
                        priority: 10
                    },
                    opentiny: {
                        test: /[\\/]node_modules[\\/]@opentiny[\\/]/,
                        name: 'opentiny',
                        priority: 9
                    }
                }
            }
        }
    },

    // 工具配置
    tools: {
        // Rspack 配置（等同于 webpack 配置）
        rspack: {
            plugins: [
                // 文件系统路由
                VueRouter({
                    routesFolder: [
                        {
                            src: 'd:/codes/befly/packages/addonAdmin/views',
                            path: 'internal/'
                        }
                    ],
                    dts: './src/types/typed-router.d.ts',
                    extensions: ['.vue'],
                    exclude: [],
                    importMode: 'async'
                }),
                // 自动导入
                AutoImport({
                    imports: ['vue', VueRouterAutoImports, 'vue-router', 'pinia', { '@opentiny/vue': ['Modal'] }],
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
                // 组件自动导入
                Components({
                    resolvers: [TinyVueSingleResolver, IconsResolver({})],
                    dirs: ['src/components'],
                    deep: true,
                    version: 3,
                    dts: 'src/types/components.d.ts'
                }),
                // 图标
                Icons({
                    compiler: 'vue3',
                    autoInstall: true,
                    defaultClass: 'icon-befly',
                    defaultStyle: 'margin-right: 8px; vertical-align: middle;'
                })
            ]
        },
        // PostCSS 配置
        postcss: {
            postcssOptions: {
                plugins: []
            }
        },
        // SCSS 配置
        sass: {
            sassOptions: {
                api: 'modern-compiler'
            }
        }
        // Sass 配置已移除 additionalData，避免变量冲突
    }
});
