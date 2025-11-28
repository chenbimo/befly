/**
 * 日志系统 - 基于 pino 实现
 */

import pino from 'pino';
import { join } from 'pathe';

import type { LoggerConfig } from '../types/befly.js';

export class Logger {
    private static instance: pino.Logger | null = null;
    private static config: LoggerConfig = {
        debug: 0,
        dir: './logs',
        console: 1,
        maxSize: 10
    };

    static configure(config: LoggerConfig): void {
        this.config = { ...this.config, ...config };
        this.instance = null;
    }

    private static getLogger(): pino.Logger {
        if (this.instance) return this.instance;

        const level = this.config.debug === 1 ? 'debug' : 'info';
        const targets: pino.TransportTargetOptions[] = [];

        // 文件输出
        targets.push({
            target: 'pino-roll',
            level: level,
            options: {
                file: join(this.config.dir || './logs', 'app'),
                frequency: 'daily',
                size: `${this.config.maxSize || 10}m`,
                mkdir: true,
                dateFormat: 'yyyy-MM-dd'
            }
        });

        // 控制台输出
        if (this.config.console === 1) {
            targets.push({
                target: 'pino/file',
                level: level,
                options: { destination: 1 }
            });
        }

        this.instance = pino({
            level: level,
            transport: { targets: targets }
        });

        return this.instance;
    }

    static info(msg: string, data?: string | object): void {
        if (typeof data === 'string') {
            this.getLogger().info(msg + ' ' + data);
        } else if (data) {
            this.getLogger().info(data, msg);
        } else {
            this.getLogger().info(msg);
        }
    }

    static warn(msg: string, data?: string | object): void {
        if (typeof data === 'string') {
            this.getLogger().warn(msg + ' ' + data);
        } else if (data) {
            this.getLogger().warn(data, msg);
        } else {
            this.getLogger().warn(msg);
        }
    }

    static error(msg: string, error?: any): void {
        if (error?.stack) {
            this.getLogger().error({ err: error }, msg);
        } else if (typeof error === 'string') {
            this.getLogger().error(msg + ' ' + error);
        } else if (error) {
            this.getLogger().error({ error: error }, msg);
        } else {
            this.getLogger().error(msg);
        }
    }

    static debug(msg: string, data?: string | object): void {
        if (typeof data === 'string') {
            this.getLogger().debug(msg + ' ' + data);
        } else if (data) {
            this.getLogger().debug(data, msg);
        } else {
            this.getLogger().debug(msg);
        }
    }

    static success(msg: string, data?: string | object): void {
        this.info(msg, data);
    }
}
