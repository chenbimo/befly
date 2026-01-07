import { existsSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vite";

import { createAnalyzerPlugin } from "./plugins/analyzer.js";
import { createAutoImportPlugin } from "./plugins/auto-import.js";
import { createComponentsPlugin } from "./plugins/components.js";
import { createDevToolsPlugin } from "./plugins/devtools.js";
import { createIconsPlugin } from "./plugins/icons.js";
import { createReactivityTransformPlugin } from "./plugins/reactivity-transform.js";
import { createRouterPlugin } from "./plugins/router.js";
import { createVuePlugin } from "./plugins/vue.js";

/**
 * 默认分包策略
 */
function defaultManualChunks(id) {
    // Vue 生态系统 - 使用更严格的匹配确保独立打包
    // 注意：必须在 befly-addon 之前判断，因为 addon 会引用这些库

    // vue-router（优先级最高）
    if (id.match(/node_modules[/\\]vue-router[/\\]/)) {
        return "vue-router";
    }

    // pinia
    if (id.match(/node_modules[/\\]pinia[/\\]/)) {
        return "pinia";
    }

    // vue 核心和运行时（@vue/* 包）
    if (id.match(/node_modules[/\\](vue[/\\]|@vue[/\\])/)) {
        return "vue";
    }

    // TDesign Vue Next
    if (id.includes("tdesign-vue-next")) {
        return "tdesign";
    }

    // 工具库
    if (id.match(/node_modules[/\\]axios[/\\]/)) {
        return "axios";
    }
    if (id.match(/node_modules[/\\]lodash-es[/\\]/)) {
        return "lodash";
    }

    // echarts
    if (id.match(/node_modules[/\\]echarts[/\\]/)) {
        return "echarts";
    }
    if (id.match(/node_modules[/\\]zrender[/\\]/)) {
        return "zrender";
    }

    // 图标
    if (id.includes("/@iconify/") || id.includes("~icons/")) {
        return "icons";
    }

    // Vue Macros
    if (id.match(/node_modules[/\\](@vue-macros|vue-macros)[/\\]/)) {
        return "vue-macros";
    }

    // 注意：不要把所有 addon 或 node_modules 强制合并到单个 chunk。
    // - addon 路由（importMode: async）应按页面懒加载自然拆分。
    // - node_modules 让 Rollup 按共享与动态导入边界自动拆分即可。
    // 如需进一步细分，可通过 createBeflyViteConfig({ manualChunks }) 注入自定义策略。
}

/**
 * 创建 Befly Vite 配置
 * @param {Object} options - 配置选项
 * @param {string} options.root - 项目根目录（可选）
 * @param {string} options.addonView - addon 内要扫描的视图目录名（可选，默认 "adminViews"）
 * @param {Object} options.resolvers - 自定义 resolvers（可选）
 * @param {Function} options.manualChunks - 自定义分包配置（可选）
 * @param {Object} options.viteConfig - 用户自定义配置（可选）
 * @returns {Object} Vite 配置对象
 */
export function createBeflyViteConfig(options = {}) {
    const { root, addonView = "adminViews", resolvers = {}, manualChunks, viteConfig = {} } = options;

    // 计算根目录（如果未提供）
    const appRoot = root || process.cwd();

    if (typeof addonView !== "string") {
        throw new Error('createBeflyViteConfig({ addonView }) 中 addonView 必须是字符串目录名。\n例如：addonView: "adminViews"');
    }

    if (addonView.trim() !== addonView) {
        throw new Error('createBeflyViteConfig({ addonView }) 中 addonView 不能包含首尾空格。\n例如：addonView: "adminViews"');
    }

    if (!addonView) {
        throw new Error('createBeflyViteConfig({ addonView }) 中 addonView 不能为空。\n例如：addonView: "adminViews"');
    }

    // 只能是单级目录名：禁止多级路径与路径穿越
    if (addonView === "." || addonView === ".." || addonView.includes("/") || addonView.includes("\\") || addonView.includes("..") || addonView.includes("\0")) {
        throw new Error('createBeflyViteConfig({ addonView }) 中 addonView 必须是单级目录名（不能是多级路径）。\n例如：addonView: "adminViews"');
    }

    const routesFolders = scanViewsInternal(appRoot, addonView);

    const baseConfig = defineConfig({
        base: "./",

        plugins: [
            //
            createRouterPlugin({ routesFolders: routesFolders }),
            createVuePlugin(),
            createReactivityTransformPlugin(),
            createDevToolsPlugin(),
            createAutoImportPlugin({ resolvers: resolvers }),
            createComponentsPlugin({ resolvers: resolvers }),
            createIconsPlugin(),
            createAnalyzerPlugin()
        ],

        resolve: {
            alias: {
                "@": fileURLToPath(new URL("src", `file:///${appRoot.replace(/\\/g, "/")}/`))
            }
        },

        server: {
            open: false,
            hmr: true
        },

        build: {
            target: "es2020",
            outDir: "dist",
            assetsDir: "assets",
            sourcemap: false,
            chunkSizeWarningLimit: 1000,
            commonjsOptions: {
                include: [/node_modules/],
                transformMixedEsModules: true
            },
            rollupOptions: {
                output: {
                    chunkFileNames: "assets/js/[name]-[hash].js",
                    entryFileNames: "assets/js/[name]-[hash].js",
                    assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
                    manualChunks(id) {
                        if (typeof manualChunks === "function") {
                            const chunkName = manualChunks(id);
                            if (chunkName) return chunkName;
                        }
                        return defaultManualChunks(id);
                    }
                }
            }
        },

        optimizeDeps: {
            include: ["vue", "vue-router", "pinia", "axios", "tdesign-vue-next"]
        }
    });

    return mergeConfig(baseConfig, viteConfig);
}

/**
 * 内部实现：扫描项目和所有 @befly-addon 包的视图目录
 * @param {string} appRoot
 * @param {string} addonView
 * @returns {Array<{ src: string, path: string, exclude: string[] }>}
 */
function scanViewsInternal(appRoot, addonView = "adminViews") {
    const addonBasePath = join(appRoot, "node_modules", "@befly-addon");

    /** @type {Array<{ src: string, path: string, exclude: string[] }>} */
    const routesFolders = [];

    // 1. 项目自身 views
    const appViewsPath = join(appRoot, "src", "views");
    if (existsSync(appViewsPath)) {
        routesFolders.push({
            src: realpathSync(appViewsPath),
            path: "",
            exclude: ["**/components/**"]
        });
    }

    // 2. 扫描 @befly-addon/*/<addonView>（仅此目录允许生成 addon 路由）
    if (!existsSync(addonBasePath)) {
        return routesFolders;
    }

    try {
        const addonDirs = readdirSync(addonBasePath);

        for (const addonName of addonDirs) {
            const addonPath = join(addonBasePath, addonName);
            if (!existsSync(addonPath)) {
                continue;
            }

            const addonViewPath = join(addonPath, addonView);
            if (existsSync(addonViewPath)) {
                routesFolders.push({
                    src: realpathSync(addonViewPath),
                    path: `addon/${addonName}/`,
                    exclude: ["**/components/**"]
                });
            }
        }
    } catch {
        // 扫描失败保持静默，避免影响 Vite 启动
    }

    return routesFolders;
}
