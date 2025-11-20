/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、用户）
 */

import { relative, basename, join } from 'pathe';
import { existsSync } from 'node:fs';
import { isPlainObject } from 'es-toolkit/compat';
import { Logger } from '../lib/logger.js';
import { calcPerfTime, scanFiles } from '../util.js';
import { projectApiDir } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from '../util.js';
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
 * 处理 API 组（导入与初始化）
 */
async function processApiGroup(apiRoutes: Map<string, ApiRoute>, files: Array<{ filePath: string; relativePath: string }>, routePrefix: string, displayNameGenerator: (apiPath: string) => string): Promise<void> {
    for (const { filePath, relativePath } of files) {
        try {
            // Windows 下路径需要转换为正斜杠格式
            const normalizedFilePath = filePath.replace(/\\/g, '/');
            const apiImport = await import(normalizedFilePath);
            const api = apiImport.default;

            // 设置默认值
            api.method = api.method || 'POST';
            api.auth = api.auth !== undefined ? api.auth : true;
            // 合并默认字段：默认字段作为基础，API 自定义字段优先级更高
            api.fields = { ...DEFAULT_API_FIELDS, ...(api.fields || {}) };
            api.required = api.required || [];

            // 构建路由
            api.route = `${api.method.toUpperCase()}/api/${routePrefix ? routePrefix + '/' : ''}${relativePath}`;
            apiRoutes.set(api.route, api);
        } catch (error: any) {
            const label = displayNameGenerator(relativePath);
            Logger.error(`[${label}] 接口 ${relativePath} 加载失败`, error);
            process.exit(1);
        }
    }
}

/**
 * 加载所有 API 路由
 * @param apiRoutes - API 路由映射表
 */
export async function loadApis(apiRoutes: Map<string, ApiRoute>): Promise<void> {
    try {
        const loadStartTime = Bun.nanoseconds();

        // 1. 加载用户 API
        const userApiFiles = await scanFiles(projectApiDir);
        await processApiGroup(apiRoutes, userApiFiles, '', () => '用户');

        // 2. 加载组件 API
        const addons = scanAddons();
        for (const addon of addons) {
            if (!addonDirExists(addon, 'apis')) continue;

            const addonApiDir = getAddonDir(addon, 'apis');
            const addonApiFiles = await scanFiles(addonApiDir);

            await processApiGroup(apiRoutes, addonApiFiles, `addon/${addon}`, () => `组件${addon}`);
        }
        const totalLoadTime = calcPerfTime(loadStartTime);
    } catch (error: any) {
        Logger.error('加载 API 时发生错误', error);
        process.exit(1);
    }
}
