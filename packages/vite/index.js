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
import { createUnoCSSPlugin } from "./plugins/unocss.js";
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

    // befly-addon（必须在 Vue 判断之后）
    if (id.includes("@befly-addon/") || id.includes("packages/addonAdmin/") || id.includes("packages\\addonAdmin\\")) {
        return "befly-addon";
    }

    // 其他 node_modules 依赖
    if (id.includes("node_modules/")) {
        return "vendor";
    }
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
    const { root, scanViews, resolvers = {}, manualChunks, userConfig = {} } = options;

    // 计算根目录（如果未提供）
    const projectRoot = root || process.cwd();

    const baseConfig = defineConfig({
        base: "./",

        plugins: [
            //
            createUnoCSSPlugin(),
            createRouterPlugin({ scanViews: scanViews }),
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
                "@": fileURLToPath(new URL("src", `file:///${projectRoot.replace(/\\/g, "/")}/`))
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
