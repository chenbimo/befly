/**
 * API 加载器
 * 负责扫描和加载所有 API 路由（组件、项目）
 */

// 内部依赖
import { existsSync } from 'node:fs';

// 外部依赖
import { relative, basename, join } from 'pathe';
import { isPlainObject } from 'es-toolkit/compat';
import { scanFiles } from 'befly-shared/scanFiles';
import { scanAddons, getAddonDir, addonDirExists } from 'befly-shared/addonHelper';

// 相对导入
import { Logger } from '../lib/logger.js';
import { projectApiDir } from '../paths.js';

// 类型导入
import type { ApiRoute } from '../types/api.js';

/**
 * 加载所有 API 路由
 * @param apis - API 跁由映射表
 */
export async function loadApis(apis: Map<string, ApiRoute>): Promise<void> {
    try {
        // 1. 扫描项目 API
        const projectApiFiles = await scanFiles(projectApiDir);
        const projectApiList = projectApiFiles.map((file) => ({
            filePath: file.filePath,
            relativePath: file.relativePath,
            type: 'project' as const,
            routePrefix: '/',
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
                    routePrefix: `/addon/${addon}/`, // 组件 API 默认带斜杠
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
                const methodStr = (api.method || 'POST').toUpperCase();
                api.auth = api.auth !== undefined ? api.auth : true;
                // 使用 API 自定义的 fields，不自动合并默认字段
                api.fields = api.fields || {};
                api.required = api.required || [];

                // 构建路由路径（不含方法）
                const routePath = `/api${apiFile.routePrefix}${apiFile.relativePath}`;

                // 支持逗号分隔的多方法，拆分后分别注册
                const methods = methodStr
                    .split(',')
                    .map((m: string) => m.trim())
                    .filter((m: string) => m);
                for (const method of methods) {
                    const route = `${method}${routePath}`;
                    // 为每个方法创建独立的路由对象
                    const routeApi = { ...api, method: method, route: route };
                    apis.set(route, routeApi);
                }
            } catch (error: any) {
                Logger.error({ err: error, api: apiFile.relativePath, type: apiFile.typeName }, '接口加载失败');
                process.exit(1);
            }
        }
    } catch (error: any) {
        Logger.error({ err: error }, '加载 API 时发生错误');
        process.exit(1);
    }
}
