/**
 * API 工具类 - TypeScript 版本
 * 提供 API 路由定义的便捷方法
 */

import type { ApiRoute, ApiHandler } from '../types/api.js';
import type { WhereConditions } from '../types/common.js';
import type { FieldRules } from '../types/apiUtils';

/**
 * API 工具类
 */
export class Api {
    /**
     * 定义 GET 请求路由
     * @param name - 接口名称
     * @param auth - 是否需要认证（true/false/角色数组）
     * @param fields - 字段规则
     * @param required - 必填字段
     * @param handler - 处理函数
     * @returns API 路由定义
     */
    static GET(name: string, auth: boolean | string[] = false, fields: FieldRules = {}, required: string[] = [], handler: ApiHandler): ApiRoute {
        return {
            method: 'GET',
            name,
            auth,
            fields,
            required,
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }

    /**
     * 定义 POST 请求路由
     * @param name - 接口名称
     * @param auth - 是否需要认证（true/false/角色数组）
     * @param fields - 字段规则
     * @param required - 必填字段
     * @param handler - 处理函数
     * @returns API 路由定义
     */
    static POST(name: string, auth: boolean | string[] = false, fields: FieldRules = {}, required: string[] = [], handler: ApiHandler): ApiRoute {
        return {
            method: 'POST',
            name,
            auth,
            fields,
            required,
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }

    /**
     * 定义 PUT 请求路由
     * @param name - 接口名称
     * @param auth - 是否需要认证（true/false/角色数组）
     * @param fields - 字段规则
     * @param required - 必填字段
     * @param handler - 处理函数
     * @returns API 路由定义
     */
    static PUT(name: string, auth: boolean | string[] = false, fields: FieldRules = {}, required: string[] = [], handler: ApiHandler): ApiRoute {
        return {
            method: 'PUT',
            name,
            auth,
            fields,
            required,
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }

    /**
     * 定义 DELETE 请求路由
     * @param name - 接口名称
     * @param auth - 是否需要认证（true/false/角色数组）
     * @param fields - 字段规则
     * @param required - 必填字段
     * @param handler - 处理函数
     * @returns API 路由定义
     */
    static DELETE(name: string, auth: boolean | string[] = false, fields: FieldRules = {}, required: string[] = [], handler: ApiHandler): ApiRoute {
        return {
            method: 'DELETE',
            name,
            auth,
            fields,
            required,
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }

    /**
     * 定义 PATCH 请求路由
     * @param name - 接口名称
     * @param auth - 是否需要认证（true/false/角色数组）
     * @param fields - 字段规则
     * @param required - 必填字段
     * @param handler - 处理函数
     * @returns API 路由定义
     */
    static PATCH(name: string, auth: boolean | string[] = false, fields: FieldRules = {}, required: string[] = [], handler: ApiHandler): ApiRoute {
        return {
            method: 'PATCH',
            name,
            auth,
            fields,
            required,
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }

    /**
     * 定义 OPTIONS 请求路由
     * @param name - 接口名称
     * @param handler - 处理函数
     * @returns API 路由定义
     */
    static OPTIONS(name: string, handler: ApiHandler): ApiRoute {
        return {
            method: 'OPTIONS',
            name,
            auth: false,
            fields: {},
            required: [],
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }
}

/**
 * 导出便捷方法
 */
export const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = Api;
