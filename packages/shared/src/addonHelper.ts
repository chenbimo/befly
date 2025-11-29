import fs from 'node:fs';
import { join } from 'pathe';
import { statSync, existsSync } from 'node:fs';

/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns addon 名称数组
 */
export const scanAddons = (cwd: string = process.cwd()): string[] => {
    const addons = new Set<string>();
    // const projectAddonsDir = join(cwd, 'addons');

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
    const beflyDir = join(cwd, 'node_modules', '@befly-addon');
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
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns 完整路径
 */
export const getAddonDir = (name: string, subDir: string, cwd: string = process.cwd()): string => {
    // 优先使用本地 addons 目录
    // const projectAddonsDir = join(cwd, 'addons');
    // const localPath = join(projectAddonsDir, name, subDir);
    // if (existsSync(localPath)) {
    //     return localPath;
    // }

    // 降级使用 node_modules 目录
    return join(cwd, 'node_modules', '@befly-addon', name, subDir);
};

/**
 * 检查 addon 子目录是否存在
 * @param name - addon 名称
 * @param subDir - 子目录名称
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns 是否存在
 */
export const addonDirExists = (name: string, subDir: string, cwd: string = process.cwd()): boolean => {
    const dir = getAddonDir(name, subDir, cwd);
    return existsSync(dir) && statSync(dir).isDirectory();
};
