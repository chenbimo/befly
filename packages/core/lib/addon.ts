/**
 * Addon 管理工具类
 * 提供 addon 的扫描、路径获取等功能
 */

import fs from 'node:fs';
import { join } from 'pathe';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { projectDir } from '../paths.js';

/**
 * Addon 管理类
 */
export class Addon {
    /**
     * 扫描所有可用的 addon
     * @returns addon 名称数组
     */
    static scan(): string[] {
        const beflyDir = join(projectDir, 'node_modules', '@befly-addon');

        if (!existsSync(beflyDir)) {
            return [];
        }

        try {
            return fs
                .readdirSync(beflyDir)
                .filter((name) => {
                    // addon 名称格式：admin, demo 等（不带 addon- 前缀）
                    const fullPath = join(beflyDir, name);
                    try {
                        const stat = statSync(fullPath);
                        return stat.isDirectory();
                    } catch {
                        return false;
                    }
                })
                .sort();
        } catch {
            return [];
        }
    }

    /**
     * 获取 addon 的指定子目录路径
     * @param name - addon 名称
     * @param subDir - 子目录名称
     * @returns 完整路径
     */
    static getDir(name: string, subDir: string): string {
        return join(projectDir, 'node_modules', '@befly-addon', name, subDir);
    }

    /**
     * 检查 addon 子目录是否存在
     * @param name - addon 名称
     * @param subDir - 子目录名称
     * @returns 是否存在
     */
    static dirExists(name: string, subDir: string): boolean {
        const dir = this.getDir(name, subDir);
        return existsSync(dir) && statSync(dir).isDirectory();
    }

    /**
     * 获取插件目录列表
     * @param addonsDir - addons 根目录路径
     * @returns 插件名称数组
     */
    static getDirs(addonsDir: string): string[] {
        return readdirSync(addonsDir).filter((name) => {
            const addonPath = join(addonsDir, name);
            return statSync(addonPath).isDirectory() && !name.startsWith('_');
        });
    }
}
