import fs from 'node:fs';
import { join } from 'pathe';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { isPlainObject } from 'es-toolkit/compat';
import { snakeCase, camelCase } from 'es-toolkit/string';
import { Logger } from './lib/logger.js';
import { projectDir } from './paths.js';
import type { KeyValue } from './types/common.js';
import type { Plugin } from './types/plugin.js';

// ========================================
// 文件扫描工具
// ========================================

// ========================================
// API 响应工具
// ========================================

/**
 * 成功响应
 */
export const Yes = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 0; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 0,
        msg: msg,
        data: data
    };
};

/**
 * 失败响应
 */
export const No = <T = any>(msg: string = '', data: T | {} = {}, other: KeyValue = {}): { code: 1; msg: string; data: T | {} } & KeyValue => {
    return {
        ...other,
        code: 1,
        msg: msg,
        data: data
    };
};

// ========================================
// 动态导入工具
// ========================================

// ========================================
// 字段转换工具（重新导出 lib/convert.ts）
// ========================================

// ========================================
// 对象操作工具
// ========================================

/**
 * 字段清理
 */
export const fieldClear = <T extends Record<string, any> = any>(data: T, excludeValues: any[] = [null, undefined], keepValues: Record<string, any> = {}): Partial<T> => {
    if (!data || !isPlainObject(data)) {
        return {};
    }

    const result: any = {};

    for (const [key, value] of Object.entries(data)) {
        if (key in keepValues) {
            if (Object.is(keepValues[key], value)) {
                result[key] = value;
                continue;
            }
        }

        const shouldExclude = excludeValues.some((excludeVal) => Object.is(excludeVal, value));
        if (shouldExclude) {
            continue;
        }

        result[key] = value;
    }

    return result;
};

// ========================================
// 日期时间工具
// ========================================

// ========================================
// Addon 工具函数
// ========================================

/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @returns addon 名称数组
 */
export const scanAddons = (): string[] => {
    const addons = new Set<string>();

    // 1. 扫描本地 addons 目录（优先级高）
    // if (existsSync(projectAddonsDir)) {
    //     try {
    //         const localAddons = fs.readdirSync(projectAddonsDir).filter((name) => {
    //             const fullPath = join(projectAddonsDir, name);
    //             try {
    //                 const stat = statSync(fullPath);
    //                 return stat.isDirectory() && !name.startsWith('_');
    //             } catch {
    //                 return false;
    //             }
    //         });
    //         localAddons.forEach((name) => addons.add(name));
    //     } catch (err) {
    //         // 忽略本地目录读取错误
    //     }
    // }

    // 2. 扫描 node_modules/@befly-addon 目录
    const beflyDir = join(projectDir, 'node_modules', '@befly-addon');
    if (existsSync(beflyDir)) {
        try {
            const npmAddons = fs.readdirSync(beflyDir).filter((name) => {
                // 如果本地已存在，跳过 npm 包版本
                if (addons.has(name)) return false;

                const fullPath = join(beflyDir, name);
                try {
                    const stat = statSync(fullPath);
                    return stat.isDirectory();
                } catch {
                    return false;
                }
            });
            npmAddons.forEach((name) => addons.add(name));
        } catch {
            // 忽略 npm 目录读取错误
        }
    }

    return Array.from(addons).sort();
};

/**
 * 获取 addon 的指定子目录路径
 * 优先返回本地 addons 目录，其次返回 node_modules 目录
 * @param name - addon 名称
 * @param subDir - 子目录名称
 * @returns 完整路径
 */
export const getAddonDir = (name: string, subDir: string): string => {
    // 优先使用本地 addons 目录
    // const localPath = join(projectAddonsDir, name, subDir);
    // if (existsSync(localPath)) {
    //     return localPath;
    // }

    // 降级使用 node_modules 目录
    return join(projectDir, 'node_modules', '@befly-addon', name, subDir);
};

/**
 * 检查 addon 子目录是否存在
 * @param name - addon 名称
 * @param subDir - 子目录名称
 * @returns 是否存在
 */
export const addonDirExists = (name: string, subDir: string): boolean => {
    const dir = getAddonDir(name, subDir);
    return existsSync(dir) && statSync(dir).isDirectory();
};
