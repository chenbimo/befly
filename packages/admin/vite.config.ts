import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueRouter from 'unplugin-vue-router/vite';
import Components from 'unplugin-vue-components/vite';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import { TinyVueSingleResolver } from '@opentiny/unplugin-tiny-vue';
import { fileURLToPath, URL } from 'node:url';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// 动态扫描所有 @befly-addon 包的 views 目录
function scanBeflyAddonViews() {
    const addonBasePath = 'node_modules/@befly-addon';
    const routesFolders: any[] = [];

    if (!existsSync(addonBasePath)) {
        console.warn(`[@befly-addon] 目录不存在: ${addonBasePath}`);
        return routesFolders;
    }

    try {
        const addonDirs = readdirSync(addonBasePath, { withFileTypes: true });

        for (const dir of addonDirs) {
            if (!dir.isDirectory()) continue;

            const addonName = dir.name;
            const viewsPath = join(addonBasePath, addonName, 'views');

            if (existsSync(viewsPath)) {
                routesFolders.push({
                    src: viewsPath,
                    path: `addon/${addonName}/`
                });
                console.log(`[VueRouter] 发现 addon: @befly-addon/${addonName}/views -> /addon/${addonName}/`);
            }
        }
    } catch (error) {
        console.error('扫描 @befly-addon 目录失败:', error);
    }

    return routesFolders;
}

export default defineConfig({
    // 插件配置
    plugins: [
        // VueRouter 必须在 Vue 插件之前
        VueRouter({
            routesFolder: scanBeflyAddonViews(),
            dts: './src/types/typed-router.d.ts',
            extensions: ['.vue'],
            importMode: 'async',
            // 全局排除 components 目录
            exclude: ['**/components/**']
        }),

        // Vue 插件
        vue({
            script: {
                defineModel: true,
                propsDestructure: true
            }
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
                api: 'modern-compiler'
            }
        }
    },

    // 定义全局变量
    define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
    },

    // 优化依赖预构建
    optimizeDeps: {
        include: ['vue', 'vue-router', 'pinia', '@opentiny/vue', 'axios']
    }
});
