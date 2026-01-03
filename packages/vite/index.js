import { existsSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vite";

import { createAnalyzerPlugin } from "./plugins/analyzer.js";
import { createAutoImportPlugin } from "./plugins/auto-import.js";
import { createComponentsPlugin } from "./plugins/components.js";
import { createCompressionPlugin } from "./plugins/compression.js";
import { createDevToolsPlugin } from "./plugins/devtools.js";
import { createIconsPlugin } from "./plugins/icons.js";
import { createReactivityTransformPlugin } from "./plugins/reactivity-transform.js";
import { createRouterPlugin } from "./plugins/router.js";
import { createVuePlugin } from "./plugins/vue.js";
import { applyLayouts, layouts, toLazyComponent, normalizeRoutePath } from "./util.js";

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
 * @param {Function} options.scanViews - 扫描视图函数（可选）
 * @param {Object} options.resolvers - 自定义 resolvers（可选）
 * @param {Function} options.manualChunks - 自定义分包配置（可选）
 * @param {Object} options.userConfig - 用户自定义配置（可选）
 * @returns {Object} Vite 配置对象
 */
export function createBeflyViteConfig(options = {}) {
    const { root, scanViews: scanViewsFn, resolvers = {}, manualChunks, userConfig = {} } = options;

    // 计算根目录（如果未提供）
    const appRoot = root || process.cwd();

    const baseConfig = defineConfig({
        base: "./",

        plugins: [
            //
            createRouterPlugin({ scanViews: scanViewsFn || scanViews }),
            createVuePlugin(),
            createReactivityTransformPlugin(),
            createDevToolsPlugin(),
            createAutoImportPlugin({ resolvers: resolvers }),
            createComponentsPlugin({ resolvers: resolvers }),
            createIconsPlugin(),
            createAnalyzerPlugin(),
            createCompressionPlugin()
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
            minify: "esbuild",
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

    return mergeConfig(baseConfig, userConfig);
}

/**
 * 应用一个最小可用的 token 鉴权守卫（业务方提供 token 获取方式与路径）。
 *
 * 约定：当路由 meta.public === true 时认为是公开路由。
 *
 * @param {import('vue-router').Router} router
 * @param {{
 *   getToken: () => any,
 *   loginPath: string,
 *   homePath: string
 * }} options
 */
export function applyTokenAuthGuard(router, options) {
    const normalizedLoginPath = normalizeRoutePath(options.loginPath);
    const normalizedHomePath = normalizeRoutePath(options.homePath);

    router.beforeEach(async (to, _from, next) => {
        const token = options.getToken();
        const toPath = normalizeRoutePath(to.path);

        // 0. 根路径重定向
        if (toPath === "/") {
            return next(token ? normalizedHomePath : normalizedLoginPath);
        }

        // 1. 未登录且访问非公开路由 → 跳转登录
        if (!token && to.meta?.public !== true && toPath !== normalizedLoginPath) {
            return next(normalizedLoginPath);
        }

        // 2. 已登录访问登录页 → 跳转首页
        if (token && toPath === normalizedLoginPath) {
            return next(normalizedHomePath);
        }

        next();
    });
}

/**
 * 创建布局组件解析器（resolver）。
 *
 * @param {{
 *   resolveDefaultLayout: () => any,
 *   resolveNamedLayout: (layoutName: string) => any,
 *   defaultLayoutName?: string
 * }} options
 * @returns {(layoutName: string) => any}
 */
export function createLayoutComponentResolver(options) {
    const defaultLayoutName = options.defaultLayoutName || "default";

    return (layoutName) => {
        if (layoutName === defaultLayoutName) {
            return toLazyComponent(options.resolveDefaultLayout());
        }

        return toLazyComponent(options.resolveNamedLayout(layoutName));
    };
}

/**
 * 将 auto-routes 的 routes 按 `_数字` 规则套用布局组件，并输出 Vue Router 的 RouteRecordRaw[]。
 *
 * @param {any[]} routes
 * @param {(layoutName: string) => any} resolveLayoutComponent
 * @returns {import('vue-router').RouteRecordRaw[]}
 */
export function buildLayoutRoutes(routes, resolveLayoutComponent) {
    return applyLayouts(layouts(routes), resolveLayoutComponent);
}

/**
 * 扫描项目和所有 @befly-addon 包的视图目录
 * 用于 unplugin-vue-router 的 routesFolder 配置
 *
 * 约定：addon 只允许从 adminViews 扫描路由：
 * - <addonRoot>/adminViews
 *
 * 注意：此函数只能在 vite.config.js 中使用（Node.js 环境），不能在浏览器中使用
 * @returns {Array<{ src: string, path: string, exclude: string[] }>} 路由文件夹配置数组
 */
export function scanViews() {
    const appRoot = process.cwd();
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

    // 2. 扫描 @befly-addon/*/adminViews（仅此目录允许生成 addon 路由）
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

            const adminViewsPath = join(addonPath, "adminViews");
            if (existsSync(adminViewsPath)) {
                routesFolders.push({
                    src: realpathSync(adminViewsPath),
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
