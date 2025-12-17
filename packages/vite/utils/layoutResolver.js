/**
 * 布局组件解析器（resolver）创建工具。
 *
 * 目的：减少业务侧重复的 layoutName -> import 逻辑，同时不把具体的路径结构（如 @/layouts）耦合进 befly-vite。
 */

/**
 * 将“组件/懒加载函数/Promise”统一转换为 Vue Router 可接受的懒加载 component 函数。
 *
 * - 如果已经是函数（通常是 `() => import(...)`），直接返回。
 * - 否则包一层函数（使其变成 lazy component）。
 *
 * @param {any} value
 * @returns {any}
 */
function toLazyComponent(value) {
    if (typeof value === "function") {
        return value;
    }

    return () => value;
}

/**
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
