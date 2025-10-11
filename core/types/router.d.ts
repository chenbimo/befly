/**
 * 路由处理器类型定义
 */

import type { ApiRoute } from './api.js';
import type { Plugin } from './plugin.js';
import type { BeflyContext } from './befly.js';

/**
 * 根路径处理器
 */
export type RootHandler = (req: Request) => Promise<Response>;

/**
 * API处理器工厂函数
 */
export type ApiHandlerFactory = (apiRoutes: Map<string, ApiRoute>, pluginLists: Plugin[], appContext: BeflyContext) => (req: Request) => Promise<Response>;

/**
 * 静态文件处理器
 */
export type StaticHandler = (req: Request) => Promise<Response>;

/**
 * 错误处理器
 */
export type ErrorHandler = (error: Error) => Response;
