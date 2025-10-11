/**
 * Addon 辅助工具函数
 * 提供 addon 扫描、路径获取等功能
 */

import fs from 'node:fs';
import { join } from 'node:path';
import { getProjectRoot } from '../system.js';

/**
 * 获取 addons 目录路径
 */
export const getAddonsDir = (): string => {
    return join(getProjectRoot(), 'addons');
};

/**
 * 扫描所有可用的 addon
 * @returns addon 名称数组（过滤掉 _ 开头的目录）
 */
export const scanAddons = (): string[] => {
    const addonsDir = getAddonsDir();
    if (!fs.existsSync(addonsDir)) {
        return [];
    }

    try {
        return fs
            .readdirSync(addonsDir)
            .filter((name) => {
                const fullPath = join(addonsDir, name);
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
    return join(getAddonsDir(), addonName, subDir);
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
