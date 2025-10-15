/**
 * Befly 框架辅助工具集
 *
 * 本文件整合了所有框架内部使用的工具函数，包括：
 * - API 定义工具
 * - Addon 管理工具
 * - Plugin 管理工具
 * - 表定义工具
 */

import fs from 'node:fs';
import { join } from 'node:path';
import { paths } from '../paths.js';
import type { ApiRoute, ApiOptions } from '../types/api.js';
import type { Plugin } from '../types/plugin.js';
import type { ParsedFieldRule } from '../types/common.js';

// ========================================
// API 定义工具
// ========================================

/**
 * 定义 API 路由（主函数）
 * @param name - 接口名称
 * @param options - 接口配置选项
 * @returns API 路由定义
 */
export function Api(name: string, options: ApiOptions): ApiRoute {
    return {
        method: options.method || 'POST',
        name: name,
        auth: options.auth ?? false,
        fields: options.fields ?? {},
        required: options.required ?? [],
        handler: async (befly, ctx, req) => await options.handler(befly, ctx, req)
    };
}

// ========================================
// Addon 管理工具
// ========================================

/**
 * 扫描所有可用的 addon
 * @returns addon 名称数组（过滤掉 _ 开头的目录）
 */
export const scanAddons = (): string[] => {
    if (!fs.existsSync(paths.projectAddonDir)) {
        return [];
    }

    try {
        return fs
            .readdirSync(paths.projectAddonDir)
            .filter((name) => {
                const fullPath = join(paths.projectAddonDir, name);
                const stat = fs.statSync(fullPath);
                const isDir = stat.isDirectory();
                const notSkip = !name.startsWith('_'); // 跳过 _ 开头的目录
                return isDir && notSkip;
            })
            .sort(); // 按字母顺序排序
    } catch (error) {
        return [];
    }
};

/**
 * 获取 addon 的指定子目录路径
 * @param addonName - addon 名称
 * @param subDir - 子目录名称（apis, checks, plugins, tables, types, config）
 */
export const getAddonDir = (addonName: string, subDir: string): string => {
    return join(paths.projectAddonDir, addonName, subDir);
};

/**
 * 检查 addon 是否存在指定子目录
 * @param addonName - addon 名称
 * @param subDir - 子目录名称
 */
export const hasAddonDir = (addonName: string, subDir: string): boolean => {
    const dir = getAddonDir(addonName, subDir);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
};

// ========================================
// Plugin 管理工具
// ========================================

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

// ========================================
// 表定义工具
// ========================================

/**
 * 解析字段规则字符串（以 | 分隔）
 * 用于解析表定义中的字段规则
 *
 * 规则格式：字段名|类型|最小值|最大值|默认值|索引|正则
 * 注意：只分割前6个|，第7个|之后的所有内容（包括|）都属于正则表达式
 *
 * @param rule - 字段规则字符串
 * @returns 解析后的字段规则对象
 *
 * @example
 * parseRule('用户名|string|2|50|null|1|null')
 * // {
 * //   name: '用户名',
 * //   type: 'string',
 * //   min: 2,
 * //   max: 50,
 * //   default: 'null',
 * //   index: 1,
 * //   regex: null
 * // }
 *
 * parseRule('年龄|number|0|150|18|0|null')
 * // {
 * //   name: '年龄',
 * //   type: 'number',
 * //   min: 0,
 * //   max: 150,
 * //   default: 18,
 * //   index: 0,
 * //   regex: null
 * // }
 *
 * parseRule('状态|string|1|20|active|1|^(active|inactive|pending)$')
 * // 正则表达式中的 | 会被保留
 */
export const parseRule = (rule: string): ParsedFieldRule => {
    // 手动分割前6个|，剩余部分作为正则表达式
    // 这样可以确保正则表达式中的|不会被分割
    const parts: string[] = [];
    let currentPart = '';
    let pipeCount = 0;

    for (let i = 0; i < rule.length; i++) {
        if (rule[i] === '|' && pipeCount < 6) {
            parts.push(currentPart);
            currentPart = '';
            pipeCount++;
        } else {
            currentPart += rule[i];
        }
    }
    // 添加最后一部分（正则表达式）
    parts.push(currentPart);

    const [fieldName = '', fieldType = 'string', fieldMinStr = 'null', fieldMaxStr = 'null', fieldDefaultStr = 'null', fieldIndexStr = '0', fieldRegx = 'null'] = parts;

    const fieldIndex = Number(fieldIndexStr) as 0 | 1;
    const fieldMin = fieldMinStr !== 'null' ? Number(fieldMinStr) : null;
    const fieldMax = fieldMaxStr !== 'null' ? Number(fieldMaxStr) : null;

    let fieldDefault: any = fieldDefaultStr;
    if (fieldType === 'number' && fieldDefaultStr !== 'null') {
        fieldDefault = Number(fieldDefaultStr);
    }

    return {
        name: fieldName,
        type: fieldType as 'string' | 'number' | 'text' | 'array',
        min: fieldMin,
        max: fieldMax,
        default: fieldDefault,
        index: fieldIndex,
        regex: fieldRegx !== 'null' ? fieldRegx : null
    };
};
