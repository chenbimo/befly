/**
 * 日志系统 - TypeScript 版本
 * 提供分级日志记录和文件管理功能
 */

import path from 'path';
import { appendFile, stat } from 'node:fs/promises';
import { formatDate } from './index.js';
import { Colors } from './colors.js';
import { Env } from '../config/env.js';
import type { LogLevel } from '../types/common.js';

/**
 * 日志消息类型
 */
type LogMessage = string | number | boolean | null | undefined | Record<string, any> | any[];

/**
 * 日志器类
 */
export class Logger {
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
     * @param colored - 是否对日志级别文字着色（仅用于控制台输出）
     * @returns 格式化后的日志字符串
     */
    static formatMessage(level: LogLevel, message: LogMessage, colored: boolean = false): string {
        const timestamp = formatDate();
        let levelStr = level.toUpperCase().padStart(5);

        // 如果需要着色，只给日志级别文字添加颜色
        if (colored) {
            const colorMap = {
                info: Colors.greenBright,
                debug: Colors.cyanBright,
                warn: Colors.yellowBright,
                error: Colors.redBright
            };
            levelStr = colorMap[level](levelStr);
        }

        // 处理不同类型的消息
        let msg = `[${timestamp}] ${levelStr} - `;
        if (typeof message === 'object' && message !== null && Object.keys(message).length > 0) {
            msg += JSON.stringify(message, null, 0).replace(/\\"/g, '"');
        } else {
            msg += String(message);
        }

        return msg;
    }

    /**
     * 移除 ANSI 颜色代码
     * @param text - 包含颜色代码的文本
     * @returns 纯文本
     */
    private static stripColors(text: string): string {
        return text.replace(/\x1b\[\d+m/g, '');
    }

    /**
     * 获取日志文件前缀
     * @param level - 日志级别
     * @returns 文件前缀
     */
    private static getFilePrefix(level: LogLevel): string {
        return level === 'debug' ? 'debug' : new Date().toISOString().split('T')[0];
    }

    /**
     * 记录日志
     * @param level - 日志级别
     * @param message - 日志消息
     */
    static async log(level: LogLevel, message: LogMessage): Promise<void> {
        // debug 日志特殊处理：仅当 LOG_DEBUG=1 时才记录
        if (level === 'debug' && Env.LOG_DEBUG !== 1) return;

        // 格式化消息（带颜色）
        const coloredMessage = this.formatMessage(level, message, true);

        // 控制台输出
        if (Env.LOG_TO_CONSOLE === 1) {
            console.log(coloredMessage);
        }

        // 文件输出（去除颜色）
        const plainMessage = this.stripColors(coloredMessage);
        await this.writeToFile(plainMessage, level);
    }

    /**
     * 写入日志文件
     * @param message - 格式化后的消息
     * @param level - 日志级别
     */
    static async writeToFile(message: string, level: LogLevel = 'info'): Promise<void> {
        try {
            const prefix = this.getFilePrefix(level);

            // 检查缓存的当前文件是否仍然可用
            let currentLogFile = this.currentFiles.get(prefix);

            if (currentLogFile) {
                try {
                    const stats = await stat(currentLogFile);
                    if (stats.size >= this.maxFileSize) {
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
                currentLogFile = await this.findAvailableLogFile(prefix);
                this.currentFiles.set(prefix, currentLogFile);
            }

            await appendFile(currentLogFile, message + '\n', 'utf8');
        } catch (error: any) {
            console.error('写入日志文件失败:', error?.message || error);
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

        // 按索引排序
        files.sort((a, b) => {
            const getIndex = (f: string) => parseInt(f.match(/\.(\d+)\.log$/)?.[1] || '0');
            return getIndex(a) - getIndex(b);
        });

        // 从最后一个文件开始检查
        for (let i = files.length - 1; i >= 0; i--) {
            const filePath = path.join(this.logDir, files[i]);
            try {
                const stats = await stat(filePath);
                if (stats.size < this.maxFileSize) return filePath;
            } catch {
                continue;
            }
        }

        // 创建新文件
        const getIndex = (f: string) => parseInt(f.match(/\.(\d+)\.log$/)?.[1] || '0');
        const maxIndex = files.length > 0 ? Math.max(...files.map(getIndex)) : -1;
        return path.join(this.logDir, `${prefix}.${maxIndex + 1}.log`);
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
     * 受 LOG_DEBUG 环境变量控制，仅当 LOG_DEBUG=1 时才记录
     * @param message - 日志消息
     */
    static async debug(message: LogMessage): Promise<void> {
        await this.log('debug', message);
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
        logDir: string;
        maxFileSize: number;
        cachedFiles: number;
    } {
        return {
            logDir: this.logDir,
            maxFileSize: this.maxFileSize,
            cachedFiles: this.currentFiles.size
        };
    }
}
