/**
 * Addon 管理工具
 *
 * 提供 addon 扫描、路径管理等功能
 */

import fs from 'node:fs';
import { join } from 'node:path';
import { paths } from '../paths.js';

/**
 * 扫描所有可用的 addon
 * 只扫描 node_modules/@befly/addon-* 包
 * @returns addon 名称数组（排序）
 */
export const scanAddons = (): string[] => {
    const beflyDir = join(paths.projectDir, 'node_modules', '@befly');

    if (!fs.existsSync(beflyDir)) {
        return [];
    }

    try {
        return fs
            .readdirSync(beflyDir)
            .filter((name) => {
                if (!name.startsWith('addon-')) return false;
                const fullPath = join(beflyDir, name);
                try {
                    const stat = fs.statSync(fullPath);
                    return stat.isDirectory();
                } catch {
                    return false;
                }
            })
            .sort();
    } catch {
        return [];
    }
};

/**
 * 获取 addon 的指定子目录路径
 * @param addonName - addon 名称
 * @param subDir - 子目录名称（apis, checks, plugins, tables, types, config）
 */
export const getAddonDir = (addonName: string, subDir: string): string => {
    return join(paths.projectDir, 'node_modules', '@befly', addonName, subDir);
};

/**
 * 检查 addon 子目录是否存在
 * @param addonName - addon 名称
 * @param subDir - 子目录名称
 */
export const addonDirExists = (addonName: string, subDir: string): boolean => {
    const dir = getAddonDir(addonName, subDir);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
};
