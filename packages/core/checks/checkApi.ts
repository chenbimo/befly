// 内部依赖
import { existsSync } from 'node:fs';

// 外部依赖
import { isPlainObject } from 'es-toolkit/compat';
import { scanAddons, getAddonDir, addonDirExists, scanFiles } from 'befly-util';

// 相对导入
import { Logger } from '../lib/logger.js';
import { projectApiDir } from '../paths.js';

/**
 * 检查所有 API 定义
 */
export async function checkApi(): Promise<void> {
    try {
        // 收集所有 API 文件
        const allApiFiles: Array<{ file: string; displayName: string; apiPath: string }> = [];

        // 收集项目 API 文件
        if (existsSync(projectApiDir)) {
            const files = await scanFiles(projectApiDir);
            for (const { filePath, relativePath } of files) {
                allApiFiles.push({
                    file: filePath,
                    displayName: '用户',
                    apiPath: relativePath
                });
            }
        }

        // 收集组件 API 文件
        const addons = scanAddons();
        for (const addon of addons) {
            if (!addonDirExists(addon, 'apis')) continue;
            const addonApiDir = getAddonDir(addon, 'apis');

            const files = await scanFiles(addonApiDir);
            for (const { filePath, relativePath } of files) {
                allApiFiles.push({
                    file: filePath,
                    displayName: `组件${addon}`,
                    apiPath: relativePath
                });
            }
        }

        // 合并进行验证逻辑
        for (const item of allApiFiles) {
            const { apiPath } = item;

            try {
                // Windows 下路径需要转换为正斜杠格式
                const filePath = item.file.replace(/\\/g, '/');
                const apiImport = await import(filePath);
                const api = apiImport.default;

                // 验证必填属性：name 和 handler
                if (typeof api.name !== 'string' || api.name.trim() === '') {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 name 属性必须是非空字符串`);
                    continue;
                }
                if (typeof api.handler !== 'function') {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 handler 属性必须是函数`);
                    continue;
                }

                // 验证可选属性的类型（如果提供了）
                if (api.method && !['GET', 'POST'].includes(api.method.toUpperCase())) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 method 属性必须是有效的 HTTP 方法`);
                }
                if (api.auth !== undefined && typeof api.auth !== 'boolean') {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 auth 属性必须是布尔值 (true=需登录, false=公开)`);
                }
                if (api.fields && !isPlainObject(api.fields)) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 fields 属性必须是对象`);
                }
                if (api.required && !Array.isArray(api.required)) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 required 属性必须是数组`);
                }
                if (api.required && api.required.some((item: any) => typeof item !== 'string')) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 required 属性必须是字符串数组`);
                }
            } catch (error: any) {
                Logger.error(`[${item.displayName}] 接口 ${apiPath} 解析失败`, error);
            }
        }
    } catch (error: any) {
        Logger.error('API 定义检查过程中出错', error);
        throw error;
    }
}
