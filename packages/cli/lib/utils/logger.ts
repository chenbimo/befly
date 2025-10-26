/**
 * Logger 工具 - 彩色日志输出
 */

import chalk from 'chalk';

export class Logger {
    static log(message: string, ...args: any[]) {
        console.log(message, ...args);
    }

    static info(message: string, ...args: any[]) {
        console.log(chalk.blue('ℹ'), message, ...args);
    }

    static success(message: string, ...args: any[]) {
        console.log(chalk.green('✔'), message, ...args);
    }

    static warn(message: string, ...args: any[]) {
        console.log(chalk.yellow('⚠'), message, ...args);
    }

    static error(message: string, ...args: any[]) {
        console.log(chalk.red('✖'), message, ...args);
    }

    static debug(message: string, ...args: any[]) {
        if (process.env.DEBUG) {
            console.log(chalk.gray('🐛'), message, ...args);
        }
    }
}
