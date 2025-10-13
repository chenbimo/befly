/**
 * 日志系统 - TypeScript 版本
 * 提供分级日志记录和文件管理功能
 */

import path from 'path';
import { appendFile, stat } from 'node:fs/promises';
import { formatDate } from './index.js';
import { Env } from '../config/env.js';
import type { LogLevel } from '../types/common.js';

/**
 * 日志级别映射
 */
interface LogLevels {
    error: number;
    warn: number;
    info: number;
    debug: number;
}

/**
 * 日志消息类型
 */
type LogMessage = string | number | boolean | null | undefined | Record<string, any> | any[];

/**
 * 日志器类
 */
export class Logger {
    /** 当前日志级别 */
    static level: LogLevel = (Env.LOG_LEVEL as LogLevel) || 'info';

    /** 日志级别权重 */
    static readonly levels: LogLevels = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    };

    /** 日志目录 */
    static logDir: string = Env.LOG_DIR || 'logs';

    /** 单个日志文件最大大小（字节） */
    static maxFileSize: number = Env.LOG_MAX_SIZE || 50 * 1024 * 1024; // 50MB

    /** 当前使用的日志文件缓存 */
    private static currentFiles: Map<string, string> = new Map();

    /**
     * 格式化日志消息
     * @param level - 日志级别
     * @param message - 日志消息
     * @returns 格式化后的日志字符串
     */
    static formatMessage(level: LogLevel, message: LogMessage): string {
        const timestamp = formatDate();
        const levelStr = level.toUpperCase().padStart(5);

        let msg = `[${timestamp}] ${levelStr} - `;

        // 处理不同类型的消息
        if (typeof message === 'object' && message !== null) {
            if (Object.keys(message).length > 0) {
                msg += JSON.stringify(message).replace(/\s+/g, ' ').replace(/\\"/g, '"').replace(/\\n/g, ' ');
            }
        } else {
            msg += String(message);
        }

        return msg;
    }

    /**
     * 检查是否应该记录该级别的日志
     * @param level - 日志级别
     * @returns 是否应该记录
     */
    private static shouldLog(level: LogLevel): boolean {
        return this.levels[level] <= this.levels[this.level];
    }

    /**
     * 记录日志
     * @param level - 日志级别
     * @param message - 日志消息
     */
    static async log(level: LogLevel, message: LogMessage): Promise<void> {
        // 检查日志级别
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message);

        // 控制台输出
        if (Env.LOG_TO_CONSOLE === 1) {
            console.log(formattedMessage);
        }

        await this.writeToFile(formattedMessage, level);
    }

    /**
     * 写入日志文件
     * @param message - 格式化后的消息
     * @param level - 日志级别
     */
    static async writeToFile(message: string, level: LogLevel = 'info'): Promise<void> {
        try {
            let prefix: string;

            // debug 日志使用单独的文件名
            if (level === 'debug') {
                prefix = 'debug';
            } else {
                prefix = new Date().toISOString().split('T')[0];
            }

            // 检查缓存的当前文件是否仍然可用
            let currentLogFile = this.currentFiles.get(prefix);

            if (currentLogFile) {
                try {
                    const stats = await stat(currentLogFile);
                    // 如果文件超过最大大小，清除缓存
                    if (stats.size >= this.maxFileSize) {
                        this.currentFiles.delete(prefix);
                        currentLogFile = undefined;
                    }
                } catch (error) {
                    // 文件不存在或无法访问，清除缓存
                    this.currentFiles.delete(prefix);
                    currentLogFile = undefined;
                }
            }

            // 如果没有缓存的文件或文件已满，查找合适的文件
            if (!currentLogFile) {
                currentLogFile = await this.findAvailableLogFile(prefix);
                this.currentFiles.set(prefix, currentLogFile);
            }

            // 使用 Node.js 的 appendFile 进行文件追加
            await appendFile(currentLogFile, message + '\n', 'utf8');
        } catch (error: any) {
            console.error('写入日志文件失败:', error.message);
        }
    }

    /**
     * 查找可用的日志文件
     * @param prefix - 文件前缀
     * @returns 可用的日志文件路径
     */
    static async findAvailableLogFile(prefix: string): Promise<string> {
        const glob = new Bun.Glob(`${prefix}.*.log`);
        const files = await Array.fromAsync(glob.scan(this.logDir));

        // 按文件名排序
        files.sort((a, b) => {
            const aNum = parseInt(a.match(/\.(\d+)\.log$/)?.[1] || '0');
            const bNum = parseInt(b.match(/\.(\d+)\.log$/)?.[1] || '0');
            return aNum - bNum;
        });

        // 从最后一个文件开始检查
        for (let i = files.length - 1; i >= 0; i--) {
            const filePath = path.join(this.logDir, files[i]);
            try {
                const stats = await stat(filePath);
                if (stats.size < this.maxFileSize) {
                    return filePath;
                }
            } catch (error) {
                // 文件不存在或无法访问，跳过
                continue;
            }
        }

        // 所有文件都已满或没有文件，创建新文件
        const existingIndices = files.map((f) => parseInt(f.match(/\.(\d+)\.log$/)?.[1] || '0'));
        const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;

        return path.join(this.logDir, `${prefix}.${nextIndex}.log`);
    }

    /**
     * 记录错误日志
     * @param message - 日志消息
     */
    static async error(message: LogMessage): Promise<void> {
        await this.log('error', message);
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
     * 记录调试日志（总是记录，忽略级别检查）
     * @param message - 日志消息
     */
    static async debug(message: LogMessage): Promise<void> {
        const formattedMessage = this.formatMessage('debug', message);

        // 控制台输出
        if (Env.LOG_TO_CONSOLE === 1) {
            console.log(formattedMessage);
        }

        await this.writeToFile(formattedMessage, 'debug');
    }

    /**
     * 设置日志级别
     * @param level - 新的日志级别
     */
    static setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * 获取当前日志级别
     * @returns 当前日志级别
     */
    static getLevel(): LogLevel {
        return this.level;
    }

    /**
     * 设置日志目录
     * @param dir - 新的日志目录
     */
    static setLogDir(dir: string): void {
        this.logDir = dir;
        // 清除文件缓存
        this.currentFiles.clear();
    }

    /**
     * 设置最大文件大小
     * @param size - 文件大小（字节）
     */
    static setMaxFileSize(size: number): void {
        this.maxFileSize = size;
    }

    /**
     * 清除文件缓存
     */
    static clearCache(): void {
        this.currentFiles.clear();
    }

    /**
     * 获取日志文件统计信息
     * @returns 日志文件统计
     */
    static getStats(): {
        level: LogLevel;
        logDir: string;
        maxFileSize: number;
        cachedFiles: number;
    } {
        return {
            level: this.level,
            logDir: this.logDir,
            maxFileSize: this.maxFileSize,
            cachedFiles: this.currentFiles.size
        };
    }
}
