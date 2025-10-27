/**
 * 日志系统 - 框架适配版本
 * 从 lib/logger 导出并自动配置 Env
 */

import { Env } from '../config/env.js';
import { Logger as LibLogger } from '../lib/logger.js';

// 自动配置日志器
LibLogger.configure({
    logDir: Env.LOG_DIR || 'logs',
    maxFileSize: Env.LOG_MAX_SIZE || 50 * 1024 * 1024, // 50MB
    enableDebug: Env.LOG_DEBUG === 1,
    toConsole: Env.LOG_TO_CONSOLE === 1
});

// 导出配置后的 Logger
export const Logger = LibLogger;
export type { LoggerConfig } from '../lib/logger.js';
