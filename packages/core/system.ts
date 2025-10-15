/**
 * Befly 框架系统路径定义 - TypeScript 版本
 * 提供统一的路径变量，供整个框架使用
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// 当前文件的路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Befly 框架根目录
export const __dirRoot = __dirname;

// 各个重要目录的路径（仅保留实际使用的）
export const __dirScript = join(__dirRoot, 'scripts');
export const __dirChecks = join(__dirRoot, 'checks');
export const __dirPlugins = join(__dirRoot, 'plugins');

/**
 * 获取项目根目录（befly 框架的使用方项目）
 */
export const getProjectRoot = (): string => {
    return process.cwd();
};

/**
 * 获取项目中的特定目录
 * @param subdir - 子目录名称
 */
export const getProjectDir = (subdir: string = ''): string => {
    return subdir ? join(getProjectRoot(), subdir) : getProjectRoot();
};
