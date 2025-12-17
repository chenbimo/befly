import VueDevTools from "vite-plugin-vue-devtools";

/**
 * 创建 Vue DevTools 插件配置（仅开发环境）
 */
export function createDevToolsPlugin() {
    // 该插件内部会引入 inspector 能力；如果在非开发环境启用，容易引入不必要的解析开销/兼容性风险。
    // Vite 的 plugins 数组允许包含 null/false，会被自动忽略。
    if (process.env.NODE_ENV === "production") {
        return null;
    }

    return VueDevTools();
}
