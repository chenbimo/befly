/**
 * Admin 插件通用工具函数
 */

import { Logger } from 'befly';
import { readdirSync, statSync } from 'node:fs';
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
 * 收集配置文件中所有菜单的 path（最多2级：父级和子级）
 * @param menus - 菜单数组
 * @returns 路径集合
 */
export function collectPaths(menus: any[]): Set<string> {
    const paths = new Set<string>();

    for (const menu of menus) {
        if (menu.path) {
            paths.add(menu.path);
        }
        // 只处理一级子菜单
        if (menu.children && menu.children.length > 0) {
            for (const child of menu.children) {
                if (child.path) {
                    paths.add(child.path);
                }
            }
        }
    }

    return paths;
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

    const { lists: allRecords } = await helper.getAll({
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
 * 获取插件目录列表
 * @param addonsDir - addons 根目录路径
 * @returns 插件名称数组
 */
export function getAddonDirs(addonsDir: string): string[] {
    try {
        return readdirSync(addonsDir).filter((name) => {
            const addonPath = path.join(addonsDir, name);
            return statSync(addonPath).isDirectory() && !name.startsWith('_');
        });
    } catch (error: any) {
        Logger.warn(`读取插件目录失败: ${addonsDir}`, error.message);
        return [];
    }
}
