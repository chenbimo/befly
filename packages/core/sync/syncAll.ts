/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncDb → syncApi → syncMenu → syncDev（syncDev 内会重建角色接口权限缓存）
 */

import type { SyncOptions } from "../types/sync.js";

import { checkApp } from "../checks/checkApp.js";
import { Logger } from "../lib/logger.js";
import { syncDataCommand } from "./syncData.js";
import { syncDbCommand } from "./syncDb.js";

export async function syncAllCommand(options: SyncOptions = {}) {
    try {
        // 0. 检查项目结构
        await checkApp();

        // 1. 同步数据库表结构
        await syncDbCommand({ dryRun: false, force: options.force || false });

        // 2. 同步数据：接口 → 菜单 → dev（共用同一份连接与 helper/cache 实例）
        await syncDataCommand();
    } catch (error: any) {
        Logger.error({ err: error }, "同步过程中发生错误");
        throw error;
    }
}
