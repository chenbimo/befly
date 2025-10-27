/**
 * Plugin 管理工具
 *
 * 提供插件排序、依赖检查等功能
 */

import type { Plugin } from '../types/plugin.js';

/**
 * 排序插件（根据依赖关系）
 * 使用拓扑排序算法，确保依赖的插件先加载
 *
 * @param plugins - 插件数组
 * @returns 排序后的插件数组，如果存在循环依赖则返回 false
 *
 * @example
 * const plugins = [
 *   { name: 'logger', dependencies: [] },
 *   { name: 'db', dependencies: ['logger'] },
 *   { name: 'api', dependencies: ['db', 'logger'] }
 * ];
 *
 * const sorted = sortPlugins(plugins);
 * // [
 * //   { name: 'logger', dependencies: [] },
 * //   { name: 'db', dependencies: ['logger'] },
 * //   { name: 'api', dependencies: ['db', 'logger'] }
 * // ]
 *
 * // 循环依赖示例
 * const badPlugins = [
 *   { name: 'a', dependencies: ['b'] },
 *   { name: 'b', dependencies: ['a'] }
 * ];
 * sortPlugins(badPlugins); // false
 */
export const sortPlugins = (plugins: Plugin[]): Plugin[] | false => {
    const result: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const pluginMap: Record<string, Plugin> = Object.fromEntries(plugins.map((p) => [p.name, p]));
    let isPass = true;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            isPass = false;
            return;
        }

        const plugin = pluginMap[name];
        if (!plugin) return; // 依赖不存在时跳过

        visiting.add(name);
        (plugin.dependencies || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.name));
    return isPass ? result : false;
};
