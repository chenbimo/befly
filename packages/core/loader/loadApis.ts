/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、项目）
 */

// 内部依赖
import { existsSync } from 'node:fs';

// 外部依赖
import { relative, basename, join } from 'pathe';
import { isPlainObject } from 'es-toolkit/compat';
import { calcPerfTime, scanFiles, scanAddons, getAddonDir, addonDirExists } from 'befly-util';

// 相对导入
import { Logger } from '../lib/logger.js';
import { projectApiDir } from '../paths.js';

// 类型导入
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
 * 加载所有 API 路由
 * @param apis - API 路由映射表
 */
export async function loadApis(apis: Map<string, ApiRoute>): Promise<void> {
    try {
        const loadStartTime = Bun.nanoseconds();

        // 1. 扫描项目 API
        const projectApiFiles = await scanFiles(projectApiDir);
        const projectApiList = projectApiFiles.map((file) => ({
            filePath: file.filePath,
            relativePath: file.relativePath,
            type: 'project' as const,
            routePrefix: '',
            typeName: '项目'
        }));

        // 2. 扫描组件 API
        const addonApiList: Array<{
            filePath: string;
            relativePath: string;
            type: 'addon';
            routePrefix: string;
            typeName: string;
        }> = [];
        const addons = scanAddons();
        for (const addon of addons) {
            if (!addonDirExists(addon, 'apis')) continue;

            const addonApiDir = getAddonDir(addon, 'apis');
            const addonApiFiles = await scanFiles(addonApiDir);

            for (const file of addonApiFiles) {
                addonApiList.push({
                    filePath: file.filePath,
                    relativePath: file.relativePath,
                    type: 'addon' as const,
                    routePrefix: `addon/${addon}`,
                    typeName: `组件${addon}`
                });
            }
        }

        // 3. 合并所有 API 文件
        const allApiFiles = [...projectApiList, ...addonApiList];

        // 4. 遍历处理所有 API 文件
        for (const apiFile of allApiFiles) {
            try {
                // Windows 下路径需要转换为正斜杠格式
                const normalizedFilePath = apiFile.filePath.replace(/\\/g, '/');
                const apiImport = await import(normalizedFilePath);
                const api = apiImport.default;

                // 设置默认值
                api.method = api.method || 'POST';
                api.auth = api.auth !== undefined ? api.auth : true;
                // 合并默认字段：默认字段作为基础，API 自定义字段优先级更高
                api.fields = { ...DEFAULT_API_FIELDS, ...(api.fields || {}) };
                api.required = api.required || [];

                // 构建路由
                api.route = `${api.method.toUpperCase()}/api/${apiFile.routePrefix ? apiFile.routePrefix + '/' : ''}${apiFile.relativePath}`;
                apis.set(api.route, api);
            } catch (error: any) {
                Logger.error(`[${apiFile.typeName}] 接口 ${apiFile.relativePath} 加载失败`, error);
                process.exit(1);
            }
        }

        const totalLoadTime = calcPerfTime(loadStartTime);
    } catch (error: any) {
        Logger.error('加载 API 时发生错误', error);
        process.exit(1);
    }
}
