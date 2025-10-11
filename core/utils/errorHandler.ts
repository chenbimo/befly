/**
 * 错误处理器
 * 提供统一的错误处理策略
 */

import { Logger } from './logger.js';

/**
 * 错误处理器类
 * 提供两种简单的错误处理方式：
 * - critical: 关键错误，记录日志并退出进程
 * - warning: 警告错误，只记录日志继续运行
 */
export class ErrorHandler {
    /**
     * 处理关键错误（会退出进程）
     * 用于：系统检查失败、核心插件失败、配置错误等
     *
     * @param message - 错误消息
     * @param error - 错误对象（可选）
     * @param meta - 额外的元数据（可选）
     */
    static critical(message: string, error?: Error, meta?: Record<string, any>): never {
        Logger.error({
            level: 'CRITICAL',
            msg: message,
            error: error?.message,
            stack: error?.stack,
            ...meta
        });

        Logger.error('系统即将退出...');
        process.exit(1);
    }

    /**
     * 处理警告错误（记录但继续运行）
     * 用于：用户插件失败、单个API加载失败等非关键错误
     *
     * @param message - 警告消息
     * @param error - 错误对象（可选）
     * @param meta - 额外的元数据（可选）
     */
    static warning(message: string, error?: Error, meta?: Record<string, any>): void {
        Logger.warn({
            level: 'WARNING',
            msg: message,
            error: error?.message,
            stack: error?.stack,
            ...meta
        });
    }

    /**
     * 处理信息级别的提示
     * 用于：非错误的重要信息提示
     *
     * @param message - 信息消息
     * @param meta - 额外的元数据（可选）
     */
    static info(message: string, meta?: Record<string, any>): void {
        Logger.info({
            level: 'INFO',
            msg: message,
            ...meta
        });
    }
}
