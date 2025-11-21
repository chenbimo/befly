/**
 * Commands 工具函数
 * 提供命令间可复用的通用功能
 */

import { join, parse, dirname, relative, normalize, sep } from 'pathe';
import { existsSync, readFileSync } from 'node:fs';
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
        console.log(chalk.blue(`当前环境: ${chalk.bold(process.env.NODE_ENV || 'development')}`));
        console.log(chalk.blue(`项目名称: ${chalk.bold(process.env.APP_NAME || '-')}`));
        console.log(chalk.blue(`数据库地址: ${chalk.bold(process.env.DB_HOST || '-')}`));
        console.log(chalk.blue(`数据库名称: ${chalk.bold(process.env.DB_NAME || '-')}`));
        console.log(chalk.cyan('========================================\n'));
    }
};
