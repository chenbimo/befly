/**
 * Befly 框架系统路径定义 - TypeScript 版本
 * 提供统一的路径变量，供整个框架使用
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

// 当前文件的路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Befly 框架根目录
export const __dirroot = __dirname;

// 各个重要目录的路径
export const __dirscript = join(__dirroot, 'scripts');
export const __dirbin = join(__dirroot, 'bin');
export const __dirutils = join(__dirroot, 'utils');
export const __dirconfig = join(__dirroot, 'config');
export const __dirtables = join(__dirroot, 'tables');
export const __dirchecks = join(__dirroot, 'checks');
export const __dirapis = join(__dirroot, 'apis');
export const __dirplugins = join(__dirroot, 'plugins');
export const __dirlibs = join(__dirroot, 'libs');
export const __dirtests = join(__dirroot, 'tests');

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

/**
 * 创建路径解析器，基于 befly 根目录
 * @param paths - 路径片段
 */
export const resolveBeflyPath = (...paths: string[]): string => {
    return resolve(__dirroot, ...paths);
};

/**
 * 创建路径解析器，基于项目根目录
 * @param paths - 路径片段
 */
export const resolveProjectPath = (...paths: string[]): string => {
    return resolve(getProjectRoot(), ...paths);
};

/**
 * 获取相对于 befly 根目录的相对路径
 * @param targetPath - 目标路径
 */
export const getRelativeBeflyPath = (targetPath: string): string => {
    return relative(__dirroot, targetPath);
};

/**
 * 获取相对于项目根目录的相对路径
 * @param targetPath - 目标路径
 */
export const getRelativeProjectPath = (targetPath: string): string => {
    return relative(getProjectRoot(), targetPath);
};

/**
 * 系统路径配置对象
 */
export interface SystemPaths {
    script: string;
    bin: string;
    utils: string;
    config: string;
    tables: string;
    checks: string;
    apis: string;
    plugins: string;
    libs: string;
    tests: string;
}

/**
 * 系统工具函数集合
 */
export interface SystemUtils {
    getProjectRoot: typeof getProjectRoot;
    getProjectDir: typeof getProjectDir;
    resolveBeflyPath: typeof resolveBeflyPath;
    resolveProjectPath: typeof resolveProjectPath;
    getRelativeBeflyPath: typeof getRelativeBeflyPath;
    getRelativeProjectPath: typeof getRelativeProjectPath;
}

/**
 * 系统配置对象
 */
export interface SystemConfig {
    __filename: string;
    __dirname: string;
    __dirroot: string;
    paths: SystemPaths;
    utils: SystemUtils;
}

/**
 * 默认导出包含所有路径信息的对象
 */
const system: SystemConfig = {
    // 基础路径变量
    __filename,
    __dirname,
    __dirroot,

    // Befly 框架目录
    paths: {
        script: __dirscript,
        bin: __dirbin,
        utils: __dirutils,
        config: __dirconfig,
        tables: __dirtables,
        checks: __dirchecks,
        apis: __dirapis,
        plugins: __dirplugins,
        libs: __dirlibs,
        tests: __dirtests
    },

    // 工具函数
    utils: {
        getProjectRoot,
        getProjectDir,
        resolveBeflyPath,
        resolveProjectPath,
        getRelativeBeflyPath,
        getRelativeProjectPath
    }
};

// 重新导出基础路径变量和 system 对象
export { __filename, __dirname, system };
