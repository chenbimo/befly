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
 * @param routePrefix - 路由前缀（如 'addon/admin', ''）
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
            // Windows 下路径需要转换为正斜杠格式
            const filePath = file.replace(/\\/g, '/');
            const apiImport = await import(filePath);
            const api = apiImport.default;

            // 设置默认值
            api.method = api.method || 'POST';
            api.auth = api.auth !== undefined ? api.auth : true;
            // 合并默认字段：先设置自定义字段，再用默认字段覆盖（默认字段优先级更高）
            api.fields = { ...(api.fields || {}), ...DEFAULT_API_FIELDS };
            api.required = api.required || [];

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
 * 加载所有 API 路由
 * @param apiRoutes - API 路由映射表
 */
export async function loadApis(apiRoutes: Map<string, ApiRoute>): Promise<void> {
    try {
        const loadStartTime = Bun.nanoseconds();

        // 1. 加载用户 APIs
        await scanApisFromDir(projectApiDir, apiRoutes, '', '用户');

        // 2. 加载组件 APIs
        const addons = scanAddons();
        for (const addon of addons) {
            if (!addonDirExists(addon, 'apis')) continue;
            const addonApiDir = getAddonDir(addon, 'apis');
            await scanApisFromDir(addonApiDir, apiRoutes, `addon/${addon}`, `组件${addon}`);
        }

        const totalLoadTime = calcPerfTime(loadStartTime);
    } catch (error: any) {
        Logger.error('加载 API 时发生错误', error);
        process.exit(1);
    }
}
