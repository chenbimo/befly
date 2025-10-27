/**
 * 日志系统 - Befly 项目专用
 * 直接集成环境变量，提供开箱即用的日志功能
 */

import path from 'path';
import { appendFile, stat } from 'node:fs/promises';
import chalk from 'chalk';
import { Env } from '../config/env.js';
import type { LogLevel } from '../types/common.js';

/**
 * 日志消息类型
 */
type LogMessage = string | number | boolean | null | undefined | Record<string, any> | any[];

/**
 * 格式化日期时间
 */
function formatDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 日志器类
 */
export class Logger {
    /** 日志配置（直接使用 Env） */
    private static readonly config = {
        logDir: Env.LOG_DIR || 'logs',
        maxFileSize: Env.LOG_MAX_SIZE || 50 * 1024 * 1024,
        enableDebug: Env.LOG_DEBUG === 1,
        toConsole: Env.LOG_TO_CONSOLE === 1
    };

    /** 当前使用的日志文件缓存 */
    private static currentFiles: Map<string, string> = new Map();

    /**
     * 记录日志
     * @param level - 日志级别
     * @param message - 日志消息
     */
    static async log(level: LogLevel, message: LogMessage): Promise<void> {
        // debug 日志特殊处理：仅当 enableDebug 为 true 时才记录
        if (level === 'debug' && !this.config.enableDebug) return;

        // 格式化消息
        const timestamp = formatDate();
        const colorMap = {
            info: chalk.greenBright,
            debug: chalk.cyanBright,
            warn: chalk.yellowBright,
            error: chalk.redBright
        };

        // 处理消息内容
        let content = '';
        if (typeof message === 'object' && message !== null && Object.keys(message).length > 0) {
            content = JSON.stringify(message, null, 0).replace(/\\"/g, '"');
        } else {
            content = String(message);
        }

        // 带颜色的控制台消息
        const coloredLevelStr = colorMap[level](level.toUpperCase().padStart(5));
        const coloredMessage = `[${timestamp}] ${coloredLevelStr} - ${content}`;

        // 控制台输出
        if (this.config.toConsole) {
            console.log(coloredMessage);
        }

        // 文件输出（去除 ANSI 颜色代码）
        const plainLevelStr = level.toUpperCase().padStart(5);
        const plainMessage = `[${timestamp}] ${plainLevelStr} - ${content}`;
        await this.writeToFile(plainMessage, level);
    }

    /**
     * 记录成功日志（使用 info 级别）
     * @param message - 日志消息
     */
    static async success(message: LogMessage): Promise<void> {
        await this.log('info', message);
    }

    /**
     * 写入日志文件
     * @param message - 格式化后的消息
     * @param level - 日志级别
     */
    static async writeToFile(message: string, level: LogLevel = 'info'): Promise<void> {
        try {
            // 确定文件前缀
            const prefix = level === 'debug' ? 'debug' : new Date().toISOString().split('T')[0];

            // 检查缓存的当前文件是否仍然可用
            let currentLogFile = this.currentFiles.get(prefix);

            if (currentLogFile) {
                try {
                    const stats = await stat(currentLogFile);
                    if (stats.size >= this.config.maxFileSize) {
                        this.currentFiles.delete(prefix);
                        currentLogFile = undefined;
                    }
                } catch {
                    this.currentFiles.delete(prefix);
                    currentLogFile = undefined;
                }
            }

            // 查找或创建新文件
            if (!currentLogFile) {
                const glob = new Bun.Glob(`${prefix}.*.log`);
                const files = await Array.fromAsync(glob.scan(this.config.logDir));

                // 按索引排序并查找可用文件
                const getIndex = (f: string) => parseInt(f.match(/\.(\d+)\.log$/)?.[1] || '0');
                files.sort((a, b) => getIndex(a) - getIndex(b));

                let foundFile = false;
                for (let i = files.length - 1; i >= 0; i--) {
                    const filePath = path.join(this.config.logDir, files[i]);
                    try {
                        const stats = await stat(filePath);
                        if (stats.size < this.config.maxFileSize) {
                            currentLogFile = filePath;
                            foundFile = true;
                            break;
                        }
                    } catch {
                        continue;
                    }
                }

                // 没有可用文件，创建新文件
                if (!foundFile) {
                    const maxIndex = files.length > 0 ? Math.max(...files.map(getIndex)) : -1;
                    currentLogFile = path.join(this.config.logDir, `${prefix}.${maxIndex + 1}.log`);
                }

                this.currentFiles.set(prefix, currentLogFile);
            }

            await appendFile(currentLogFile, message + '\n', 'utf8');
        } catch (error: any) {
            console.error('写入日志文件失败:', error?.message || error);
        }
    }

    /**
     * 记录错误日志
     * @param name - 错误名称/位置
     * @param error - 错误对象或消息
     */
    static async error(name: string, error?: any): Promise<void> {
        if (!error) {
            return this.log('error', name);
        }

        // 构建错误消息
        const parts = [name];
        if (error?.message || error?.stack) {
            if (error.message) parts.push(error.message);
            if (error.stack) parts.push('\n' + error.stack);
        } else {
            const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
            parts.push(errorStr);
        }

        await this.log('error', parts.join(' - '));
    }

    /**
     * 记录警告日志
     * @param message - 日志消息
     */
    static async warn(message: LogMessage): Promise<void> {
        await this.log('warn', message);
    }

    /**
     * 记录信息日志
     * @param message - 日志消息
     */
    static async info(message: LogMessage): Promise<void> {
        await this.log('info', message);
    }

    /**
     * 记录调试日志
     * 受 enableDebug 配置控制，仅当 enableDebug=true 时才记录
     * @param message - 日志消息
     */
    static async debug(message: LogMessage): Promise<void> {
        await this.log('debug', message);
    }

    /**
     * 清除文件缓存
     */
    static clearCache(): void {
        this.currentFiles.clear();
    }
}
