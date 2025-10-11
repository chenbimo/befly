/**
 * 错误处理器
 * 处理服务器错误
 */

import { Logger } from '../utils/logger.js';
import { No } from '../utils/index.js';

/**
 * 错误处理器
 */
export function errorHandler(error: Error): Response {
    Logger.error({
        msg: '服务启动时发生错误',
        error: error.message,
        stack: error.stack
    });
    return Response.json(No('内部服务器错误'));
}
