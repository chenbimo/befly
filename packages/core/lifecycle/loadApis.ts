/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（核心、组件、用户）
 */

import { relative, basename } from 'pathe';
import { existsSync } from 'node:fs';
import { isPlainObject } from 'es-toolkit/compat';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from '../util.js';
import { coreApiDir, projectApiDir } from '../paths.js';
import { Addon } from '../lib/addon.js';
import type { ApiRoute } from '../types/api.js';

/**
 * API 默认字段定义
 * 这些字段会自动合并到所有 API 的 fields 中
 * API 自定义的同名字段可以覆盖这些默认值
 */
const DEFAULT_API_FIELDS = {
    id: {
        name: 'ID',
        type: 'number',
        min: 1,
        max: null
    },
    page: {
        name: '页码',
        type: 'number',
        min: 1,
        max: 9999
    },
    limit: {
        name: '每页数量',
        type: 'number',
        min: 1,
        max: 100
    },
    keyword: {
        name: '关键词',
        type: 'string',
        min: 1,
        max: 50
    },
    state: {
        name: '状态',
        type: 'number',
        min: 0,
        max: 2
    }
} as const;

/**
 * 扫描单个目录的 API 文件
 * @param apiDir - API 目录路径
 * @param apiRoutes - API 路由映射表
 * @param routePrefix - 路由前缀（如 'core', 'addon/admin', ''）
 * @param displayName - 显示名称（用于日志）
 */
async function scanApisFromDir(apiDir: string, apiRoutes: Map<string, ApiRoute>, routePrefix: string, displayName: string): Promise<void> {
    if (!existsSync(apiDir)) {
        return;
    }

    const glob = new Bun.Glob('**/*.ts');

    for await (const file of glob.scan({
        cwd: apiDir,
        onlyFiles: true,
        absolute: true
    })) {
        const fileName = basename(file).replace(/\.ts$/, '');
        const apiPath = relative(apiDir, file).replace(/\.ts$/, '');
        if (apiPath.indexOf('_') !== -1) continue;

        try {
            const apiImport = await import(file);
            const api = apiImport.default;
            // 验证必填属性：name 和 handler
            if (typeof api.name !== 'string' || api.name.trim() === '') {
                throw new Error(`接口 ${apiPath} 的 name 属性必须是非空字符串`);
            }
            if (typeof api.handler !== 'function') {
                throw new Error(`接口 ${apiPath} 的 handler 属性必须是函数`);
            }
            // 设置默认值
            api.method = api.method || 'POST';
            api.auth = api.auth !== undefined ? api.auth : true;
            // 合并默认字段：先设置自定义字段，再用默认字段覆盖（默认字段优先级更高）
            api.fields = { ...(api.fields || {}), ...DEFAULT_API_FIELDS };
            api.required = api.required || [];
            // 验证可选属性的类型（如果提供了）
            if (api.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(api.method.toUpperCase())) {
                throw new Error(`接口 ${apiPath} 的 method 属性必须是有效的 HTTP 方法`);
            }
            if (api.auth !== undefined && typeof api.auth !== 'boolean') {
                throw new Error(`接口 ${apiPath} 的 auth 属性必须是布尔值 (true=需登录, false=公开)`);
            }
            if (api.fields && !isPlainObject(api.fields)) {
                throw new Error(`接口 ${apiPath} 的 fields 属性必须是对象`);
            }
            if (api.required && !Array.isArray(api.required)) {
                throw new Error(`接口 ${apiPath} 的 required 属性必须是数组`);
            }
            if (api.required && api.required.some((item: any) => typeof item !== 'string')) {
                throw new Error(`接口 ${apiPath} 的 required 属性必须是字符串数组`);
            }
            // 构建路由
            api.route = `${api.method.toUpperCase()}/api/${routePrefix ? routePrefix + '/' : ''}${apiPath}`;
            apiRoutes.set(api.route, api);
        } catch (error: any) {
            Logger.error(`[${displayName}] 接口 ${apiPath} 加载失败`, error);
            process.exit(1);
        }
    }
}

/**
 * 扫描核心 APIs
 */
async function scanCoreApis(apiRoutes: Map<string, ApiRoute>): Promise<void> {
    await scanApisFromDir(coreApiDir, apiRoutes, 'core', '核心');
}

/**
 * 扫描组件 APIs
 */
async function scanAddonApis(apiRoutes: Map<string, ApiRoute>): Promise<void> {
    const addons = Addon.scan();

    for (const addon of addons) {
        if (!Addon.dirExists(addon, 'apis')) continue;

        const addonApiDir = Addon.getDir(addon, 'apis');
        await scanApisFromDir(addonApiDir, apiRoutes, `addon/${addon}`, `组件${addon}`);
    }
}

/**
 * 扫描用户 APIs
 */
async function scanUserApis(apiRoutes: Map<string, ApiRoute>): Promise<void> {
    await scanApisFromDir(projectApiDir, apiRoutes, '', '用户');
}

/**
 * 加载所有 API 路由
 * @param apiRoutes - API 路由映射表
 */
export async function loadApis(apiRoutes: Map<string, ApiRoute>): Promise<void> {
    try {
        const loadStartTime = Bun.nanoseconds();

        // 扫描所有 APIs
        await scanCoreApis(apiRoutes);
        await scanAddonApis(apiRoutes);
        await scanUserApis(apiRoutes);

        const totalLoadTime = calcPerfTime(loadStartTime);
    } catch (error: any) {
        Logger.error('加载 API 时发生错误', error);
        process.exit(1);
    }
}
