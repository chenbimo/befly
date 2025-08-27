import path from 'path';
import { appendFile, stat } from 'node:fs/promises';
import { formatDate } from './index.js';
import { Env } from '../config/env.js';

export class Logger {
    // 静态属性
    static level = Env.LOG_LEVEL || 'info';
    static levels = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    };
    static logDir = Env.LOG_DIR || 'logs';
    static maxFileSize = Env.LOG_MAX_SIZE || 50 * 1024 * 1024; // 50MB
    static currentFiles = new Map(); // key: prefix, value: filepath

    static formatMessage(level, message) {
        const timestamp = formatDate();
        const levelStr = level.toUpperCase().padStart(5);

        let msg = `[${timestamp}] ${levelStr} - `;

        if (Object.keys(message).length > 0) {
            msg += `${JSON.stringify(message).replace(/\s+/g, ' ').replace(/\\"/g, '"').replace(/\\n/g, ' ')}`;
        }

        return msg;
    }

    static async log(level, message) {
        // 内联 shouldLog 逻辑，检查日志级别
        if (this.levels[level] > this.levels[this.level]) return;

        const formattedMessage = this.formatMessage(level, message);

        // 控制台输出
        if (Env.LOG_TO_CONSOLE === 1) {
            console.log(formattedMessage);
        }

        await this.writeToFile(formattedMessage, level);
    }

    static async writeToFile(message, level = 'info') {
        try {
            let prefix;

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
                        currentLogFile = null;
                    }
                } catch (error) {
                    // 文件不存在或无法访问，清除缓存
                    this.currentFiles.delete(prefix);
                    currentLogFile = null;
                }
            }

            // 如果没有缓存的文件或文件已满，查找合适的文件
            if (!currentLogFile) {
                currentLogFile = await this.findAvailableLogFile(prefix);
                this.currentFiles.set(prefix, currentLogFile);
            }

            // 使用 Node.js 的 appendFile 进行文件追加
            await appendFile(currentLogFile, message + '\n', 'utf8');
        } catch (error) {
            console.error('写入日志文件失败:', error.message);
        }
    }

    static async findAvailableLogFile(prefix) {
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
        const nextIndex = files.length > 0 ? Math.max(...files.map((f) => parseInt(f.match(/\.(\d+)\.log$/)?.[1] || '0'))) + 1 : 0;

        return path.join(this.logDir, `${prefix}.${nextIndex}.log`);
    }

    // 静态便捷方法
    static async error(message) {
        await this.log('error', message);
    }

    static async warn(message) {
        await this.log('warn', message);
    }

    static async info(message) {
        await this.log('info', message);
    }

    static async debug(message) {
        // debug 级别必须记录，忽略级别检查
        const formattedMessage = this.formatMessage('debug', message);

        // 控制台输出
        if (Env.LOG_TO_CONSOLE === 1) {
            console.log(formattedMessage);
        }

        await this.writeToFile(formattedMessage, 'debug');
    }
}
