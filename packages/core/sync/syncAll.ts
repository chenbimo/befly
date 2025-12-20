/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncTable → syncData（syncData 内按顺序执行：syncApi → syncMenu → syncDev）
 */

import type { SyncOptions } from "../types/sync.js";

import { Logger } from "../lib/logger.js";
import { syncDataCommand } from "./syncData.js";
import { syncDbCommand } from "./syncTable.js";

export async function syncAllCommand(options: SyncOptions = {}) {
    try {
        // 1. 同步数据库表结构
        await syncDbCommand({ dryRun: false, force: options.force || false });

        // 2. 同步数据：接口 → 菜单 → dev（共用同一份连接与 helper/cache 实例）
        await syncDataCommand();
    } catch (error: any) {
        Logger.error({ err: error }, "同步过程中发生错误");
        throw error;
    }
}
