/**
 * API 工具类 - TypeScript 版本
 * 提供 API 路由定义的便捷方法
 */

import type { ApiRoute, ApiOptions } from '../types/api.js';

/**
 * 定义 API 路由（主函数）
 * @param name - 接口名称
 * @param options - 接口配置选项
 * @returns API 路由定义
 */
export function Api(name: string, options: ApiOptions): ApiRoute {
    return {
        method: options.method || 'POST',
        name: name,
        auth: options.auth ?? false,
        fields: options.fields ?? {},
        required: options.required ?? [],
        handler: async (befly, ctx, req) => await options.handler(befly, ctx, req)
    };
}
