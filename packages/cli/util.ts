/**
 * Commands 工具函数
 * 提供命令间可复用的通用功能
 */

import { join, parse, dirname, relative, normalize, sep } from 'pathe';
import { existsSync, readFileSync } from 'node:fs';
import { Env } from 'befly';
import chalk from 'chalk';

export const projectDir = process.cwd();

/**
 * CLI Logger 工具
 * 提供统一的日志输出功能
 */
export const Logger = {
    /**
     * 普通日志
     */
    log(...args: any[]) {
        console.log(...args);
    },

    /**
     * 信息日志（蓝色）
     */
    info(...args: any[]) {
        console.log(chalk.blue(...args));
    },

    /**
     * 成功日志（绿色）
     */
    success(...args: any[]) {
        console.log(chalk.green(...args));
    },

    /**
     * 警告日志（黄色）
     */
    warn(...args: any[]) {
        console.warn(chalk.yellow(...args));
    },

    /**
     * 错误日志（红色）
     */
    error(...args: any[]) {
        console.error(chalk.red(...args));
    },

    /**
     * 调试日志（灰色）
     */
    debug(...args: any[]) {
        console.log(chalk.gray(...args));
    },

    /**
     * 打印当前运行环境
     * 用于命令开始时提示用户当前环境
     */
    printEnv() {
        console.log(chalk.cyan('========================================'));
        console.log(chalk.bold('开始执行完整同步流程'));
        console.log(chalk.blue(`当前环境: ${chalk.bold(Env.NODE_ENV || 'development')}`));
        console.log(chalk.blue(`项目名称: ${chalk.bold(Env.APP_NAME || '-')}`));
        console.log(chalk.blue(`数据库地址: ${chalk.bold(Env.DB_HOST || '-')}`));
        console.log(chalk.blue(`数据库名称: ${chalk.bold(Env.DB_NAME || '-')}`));
        console.log(chalk.cyan('========================================\n'));
    }
};

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

/**
 * 判断路径是否在 internal 目录内
 */
export function isInternalPath(filePath: string, baseDir: string): boolean {
    const rel = normalize(relative(baseDir, filePath));
    const parts = rel.split(sep);
    return parts.includes('internal');
}

/**
 * 判断路径是否应该被排除
 */
export function shouldExclude(filePath: string, baseDir: string): boolean {
    const rel = normalize(relative(baseDir, filePath));
    const parts = rel.split(sep);

    if (parts.includes('node_modules')) {
        return true;
    }

    return false;
}
