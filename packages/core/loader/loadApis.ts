/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、用户）
 */

import { relative, basename, join } from 'pathe';
import { existsSync } from 'node:fs';
import { isPlainObject } from 'es-toolkit/compat';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from '../util.js';
import { projectApiDir } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from '../util.js';
import type { ApiRoute } from '../types/api.js';

const API_GLOB_PATTERN = '**/*.{ts,js}';

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
 * 扫描用户 API 文件
 */
async function scanUserApis(): Promise<Array<{ file: string; routePrefix: string; displayName: string }>> {
    const apis: Array<{ file: string; routePrefix: string; displayName: string }> = [];

    if (!existsSync(projectApiDir)) {
        return apis;
    }

    const glob = new Bun.Glob(API_GLOB_PATTERN);

    for await (const file of glob.scan({
        cwd: projectApiDir,
        onlyFiles: true,
        absolute: true
    })) {
        if (file.endsWith('.d.ts')) {
            continue;
        }
        const apiPath = relative(projectApiDir, file).replace(/\.(ts|js)$/, '');
        if (apiPath.indexOf('_') !== -1) continue;

        apis.push({
            file: file,
            routePrefix: '',
            displayName: '用户'
        });
    }

    return apis;
}

/**
 * 扫描组件 API 文件
 */
async function scanAddonApis(): Promise<Array<{ file: string; routePrefix: string; displayName: string }>> {
    const apis: Array<{ file: string; routePrefix: string; displayName: string }> = [];
    const glob = new Bun.Glob(API_GLOB_PATTERN);
    const addons = scanAddons();

    for (const addon of addons) {
        if (!addonDirExists(addon, 'apis')) continue;

        const addonApiDir = getAddonDir(addon, 'apis');
        for await (const file of glob.scan({
            cwd: addonApiDir,
            onlyFiles: true,
            absolute: true
        })) {
            if (file.endsWith('.d.ts')) {
                continue;
            }
            const apiPath = relative(addonApiDir, file).replace(/\.(ts|js)$/, '');
            if (apiPath.indexOf('_') !== -1) continue;

            apis.push({
                file: file,
                routePrefix: `addon/${addon}`,
                displayName: `组件${addon}`
            });
        }
    }

    return apis;
}

/**
 * 初始化单个 API
 */
async function initApi(apiRoutes: Map<string, ApiRoute>, apiInfo: { file: string; routePrefix: string; displayName: string }): Promise<void> {
    const { file, routePrefix, displayName } = apiInfo;
    const apiDir = routePrefix === '' ? projectApiDir : getAddonDir(routePrefix.replace('addon/', ''), 'apis');
    const apiPath = relative(apiDir, file).replace(/\.(ts|js)$/, '');

    try {
        // Windows 下路径需要转换为正斜杠格式
        const filePath = file.replace(/\\/g, '/');
        const apiImport = await import(filePath);
        const api = apiImport.default;

        // 设置默认值
        api.method = api.method || 'POST';
        api.auth = api.auth !== undefined ? api.auth : true;
        // 合并默认字段：默认字段作为基础，API 自定义字段优先级更高
        api.fields = { ...DEFAULT_API_FIELDS, ...(api.fields || {}) };
        api.required = api.required || [];

        // 构建路由
        api.route = `${api.method.toUpperCase()}/api/${routePrefix ? routePrefix + '/' : ''}${apiPath}`;
        apiRoutes.set(api.route, api);
    } catch (error: any) {
        Logger.error(`[${displayName}] 接口 ${apiPath} 加载失败`, error);
        process.exit(1);
    }
}

/**
 * 加载所有 API 路由
 * @param apiRoutes - API 路由映射表
 */
export async function loadApis(apiRoutes: Map<string, ApiRoute>): Promise<void> {
    try {
        const loadStartTime = Bun.nanoseconds();

        // 阶段1：扫描所有 API
        const userApis = await scanUserApis();
        const addonApis = await scanAddonApis();

        // 阶段2：初始化所有 API（用户 → 组件）
        // 2.1 初始化用户 APIs
        for (const apiInfo of userApis) {
            await initApi(apiRoutes, apiInfo);
        }

        // 2.2 初始化组件 APIs
        for (const apiInfo of addonApis) {
            await initApi(apiRoutes, apiInfo);
        }

        const totalLoadTime = calcPerfTime(loadStartTime);
    } catch (error: any) {
        Logger.error('加载 API 时发生错误', error);
        process.exit(1);
    }
}
