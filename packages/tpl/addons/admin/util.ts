/**
 * Admin 插件通用工具函数
 */

import { Logger, Addon } from 'befly';
import type { BeflyContext } from 'befly/types/befly';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 递归扫描目录下的所有 .ts 文件
 * @param dir - 目录路径
 * @param fileList - 文件列表
 * @returns 文件路径数组
 */
export function scanTsFiles(dir: string, fileList: string[] = []): string[] {
    try {
        const files = readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = statSync(filePath);

            if (stat.isDirectory()) {
                // 递归扫描子目录
                scanTsFiles(filePath, fileList);
            } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
                fileList.push(filePath);
            }
        }
    } catch (error: any) {
        Logger.warn(`扫描目录失败: ${dir}`, error.message);
    }

    return fileList;
}

/**
 * 检查数据表是否存在
 * @param helper - DbHelper 实例
 * @param tableName - 表名
 * @returns 是否存在
 */
export async function checkTableExists(helper: any, tableName: string): Promise<boolean> {
    Logger.info('=== 检查数据表 ===');
    const exists = await helper.tableExists(tableName);

    if (!exists) {
        Logger.error(`❌ 表 ${tableName} 不存在，请先运行 befly syncDb 同步数据库`);
        return false;
    }

    Logger.info(`✅ 表 ${tableName} 存在`);
    return true;
}

/**
 * 删除数据库中不存在于配置的记录
 * @param helper - DbHelper 实例
 * @param tableName - 表名
 * @param configPaths - 配置中的路径集合
 * @param pathField - 路径字段名（默认为 'path'）
 * @returns 删除数量
 */
export async function deleteObsoleteRecords(helper: any, tableName: string, configPaths: Set<string>, pathField: string = 'path'): Promise<number> {
    Logger.info(`\n=== 删除配置中不存在的记录 ===`);

    const allRecords = await helper.getAll({
        table: tableName,
        fields: ['id', pathField, 'name']
    });

    let deletedCount = 0;
    for (const record of allRecords) {
        if (record[pathField] && !configPaths.has(record[pathField])) {
            await helper.delData({
                table: tableName,
                where: { id: record.id }
            });
            deletedCount++;
            Logger.info(`  └ 删除记录: ${record.name} (ID: ${record.id}, ${pathField}: ${record[pathField]})`);
        }
    }

    if (deletedCount === 0) {
        Logger.info('  ✅ 无需删除的记录');
    }

    return deletedCount;
}

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
 * 缓存角色权限到 Redis Set（增量更新）
 * @param befly - Befly 上下文
 * @param roleCode - 角色代码
 * @param apiIds - 接口 ID 数组（逗号分隔的字符串）
 */
export async function cacheRolePermissions(befly: BeflyContext, roleCode: string, apiIds: string): Promise<void> {
    try {
        if (!apiIds) {
            // 如果没有权限，删除缓存
            await befly.redis.del(`role:apis:${roleCode}`);
            Logger.debug(`已删除角色 ${roleCode} 的权限缓存（无权限）`);
            return;
        }

        // 解析接口 ID 列表
        const apiIdArray = apiIds
            .split(',')
            .map((id: string) => parseInt(id.trim()))
            .filter((id: number) => !isNaN(id));

        if (apiIdArray.length === 0) {
            await befly.redis.del(`role:apis:${roleCode}`);
            Logger.debug(`已删除角色 ${roleCode} 的权限缓存（ID 列表为空）`);
            return;
        }

        // 查询所有接口
        const allApis = await befly.db.getAll({
            table: 'addon_admin_api',
            fields: ['id', 'path', 'method']
        });

        // 根据 ID 过滤出接口路径
        const roleApiPaths = allApis.filter((api: any) => apiIdArray.includes(api.id)).map((api: any) => `${api.method}${api.path}`);

        if (roleApiPaths.length === 0) {
            await befly.redis.del(`role:apis:${roleCode}`);
            Logger.debug(`已删除角色 ${roleCode} 的权限缓存（无匹配接口）`);
            return;
        }

        // 使用 Redis Set 缓存（先删除再添加，确保数据一致性）
        const redisKey = `role:apis:${roleCode}`;
        await befly.redis.del(redisKey);
        const result = await befly.redis.sadd(redisKey, roleApiPaths);

        Logger.debug(`已缓存角色 ${roleCode} 的权限: ${result} 个接口`);
    } catch (error: any) {
        Logger.warn(`缓存角色 ${roleCode} 权限失败:`, error?.message || '未知错误');
    }
}

/**
 * 删除角色权限缓存
 * @param befly - Befly 上下文
 * @param roleCode - 角色代码
 */
export async function deleteRolePermissions(befly: BeflyContext, roleCode: string): Promise<void> {
    try {
        await befly.redis.del(`role:apis:${roleCode}`);
        Logger.debug(`已删除角色 ${roleCode} 的权限缓存`);
    } catch (error: any) {
        Logger.warn(`删除角色 ${roleCode} 权限缓存失败:`, error?.message || '未知错误');
    }
}

/**
 * 获取插件列表
 * @returns 插件列表
 */
export function getAddonList(): Array<{ name: string; title: string; version: string; description: string; enabled: boolean }> {
    const addonList: Array<{ name: string; title: string; version: string; description: string; enabled: boolean }> = [];

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
                    description: config.description || '',
                    enabled: true
                });
            } catch (error) {
                // 配置文件不存在或解析失败，使用默认值
                addonList.push({
                    name: addonName,
                    title: addonName,
                    version: '1.0.0',
                    description: '',
                    enabled: true
                });
            }
        }
    } catch (error: any) {
        Logger.warn(`扫描插件目录失败:`, error?.message || '未知错误');
    }

    return addonList;
}
