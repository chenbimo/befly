/**
 * Commands 工具函数
 * 提供命令间可复用的通用功能
 */

import { join, parse, dirname } from 'pathe';
import { existsSync, readFileSync } from 'node:fs';

/**
 * 获取项目根目录
 * 向上查找包含 package.json 的目录
 *
 * @returns 项目根目录路径
 */
export function getProjectRoot(): string {
    let current = process.cwd();
    const root = parse(current).root;

    while (current !== root) {
        if (existsSync(join(current, 'package.json'))) {
            return current;
        }
        current = dirname(current);
    }

    return process.cwd();
}

/**
 * 读取 package.json 文件内容
 *
 * @param pkgPath package.json 文件路径
 * @returns package.json 的内容对象
 */
export function readPackageJson(pkgPath: string): Record<string, any> {
    try {
        const content = readFileSync(pkgPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`读取 package.json 失败: ${error}`);
    }
}

/**
 * 获取指定目录的 package.json 版本号
 *
 * @param dir 目录路径
 * @returns 版本号字符串
 */
export function getPackageVersion(dir: string): string {
    try {
        const pkgPath = join(dir, 'package.json');
        const pkg = readPackageJson(pkgPath);
        return pkg.version || '0.0.0';
    } catch (error) {
        return '0.0.0';
    }
}
