/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncDb → syncApi → syncMenu → syncDev（syncDev 内会重建角色接口权限缓存）
 */

import type { SyncOptions } from "../types/index.js";

import { checkApp } from "../checks/checkApp.js";
import { Logger } from "../lib/logger.js";
import { syncApiCommand } from "./syncApi.js";
import { syncDbCommand } from "./syncDb.js";
import { syncDevCommand } from "./syncDev.js";
import { syncMenuCommand } from "./syncMenu.js";

export async function syncAllCommand(options: SyncOptions = {}) {
  try {
    // 0. 检查项目结构
    await checkApp();

    // 1. 同步数据库表结构
    await syncDbCommand({ dryRun: false, force: options.force || false });

    // 2. 同步接口（并缓存）
    await syncApiCommand();

    // 3. 同步菜单（并缓存）
    await syncMenuCommand();

    // 4. 同步开发管理员（syncDev 内会重建角色接口权限缓存）
    await syncDevCommand();
  } catch (error: any) {
    Logger.error({ err: error }, "同步过程中发生错误");
    throw error;
  }
}
