/**
 * Admin 插件通用工具函数
 */

import { Logger } from 'befly';
import type { BeflyContext } from 'befly/types/befly';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 输出同步统计信息
 * @param stats - 统计对象
 * @param deletedCount - 删除数量
 * @param resourceName - 资源名称（如：菜单、接口）
 */
export function logSyncStats(stats: { created: number; updated: number }, deletedCount: number, resourceName: string = '记录'): void {
    Logger.info(`\n=== ${resourceName}同步完成 ===`);
    Logger.info(`新增${resourceName}: ${stats.created} 个`);
    Logger.info(`更新${resourceName}: ${stats.updated} 个`);
    Logger.info(`删除${resourceName}: ${deletedCount} 个`);
}

/**
 * 获取插件列表
 * @returns 插件列表
 */
export function getAddonList(): Array<{ name: string; title: string; version: string; description: string }> {
    const addonList: Array<{ name: string; title: string; version: string; description: string }> = [];

    // 获取 addons 目录路径
    const addonsDir = path.join(process.cwd(), 'addons');

    try {
        const addonNames = readdirSync(addonsDir);

        for (const addonName of addonNames) {
            const addonPath = path.join(addonsDir, addonName);
            const stat = statSync(addonPath);

            // 只处理目录
            if (!stat.isDirectory()) {
                continue;
            }

            // 读取插件配置文件
            const configPath = path.join(addonPath, 'addon.config.json');

            try {
                const configContent = readFileSync(configPath, 'utf-8');
                const config = JSON.parse(configContent);

                addonList.push({
                    name: config.name || addonName,
                    title: config.title || addonName,
                    version: config.version || '1.0.0',
                    description: config.description || ''
                });
            } catch (error) {
                // 配置文件不存在或解析失败，使用默认值
                addonList.push({
                    name: addonName,
                    title: addonName,
                    version: '1.0.0',
                    description: ''
                });
            }
        }
    } catch (error: any) {
        Logger.warn(`扫描插件目录失败:`, error?.message || '未知错误');
    }

    return addonList;
}
