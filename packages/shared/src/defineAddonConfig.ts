import { join, basename } from 'pathe';

import { mergeAndConcat } from 'merge-anything';

import { scanConfig } from './scanConfig.js';

/**
 * Addon 配置定义函数
 * 接受 addon 配置对象，从当前执行目录的 config 目录下查找同名配置文件进行合并
 * 只能在 addon.config.js 文件中使用
 * @param metaDirname - import.meta.dirname
 * @param addonConfig - addon 配置对象
 * @returns 合并后的配置对象
 * @example
 * ```ts
 * // 在 packages/addonAdmin/addon.config.js 中
 * import { defineAddonConfig } from 'befly-shared/defineAddonConfig';
 *
 * export default defineAddonConfig(import.meta.dirname, {
 *     menus: [...]
 * });
 * // 自动从目录名提取 addon 名称，并从 process.cwd()/config/addonAdmin.{js,ts,json} 读取配置并合并
 * ```
 */
export async function defineAddonConfig(metaDirname: string, addonConfig: Record<string, any> = {}): Promise<Record<string, any>> {
    try {
        // 1. 使用 pathe 的 basename 获取完整的目录名（保留 addon 前缀）
        const addonName = basename(metaDirname);

        // 2. 从当前执行目录的 config 目录查找配置
        const projectConfigDir = join(process.cwd(), 'config');

        // 3. 使用 scanConfig 加载项目配置
        const projectConfig = await scanConfig({
            dirs: [projectConfigDir],
            files: [addonName]
        });

        // 4. 合并 addon 配置和项目配置（项目配置优先级更高）
        return mergeAndConcat({}, addonConfig, projectConfig);
    } catch (error: any) {
        console.error('defineAddonConfig 失败:', error.message);
        return addonConfig;
    }
}
