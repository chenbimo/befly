/**
 * 数据库插件 - TypeScript 版本
 * 初始化数据库连接和 SQL 管理器
 */

import { Logger } from '../lib/logger.js';
import { Connect } from '../lib/connect.js';
import { DbHelper } from '../lib/dbHelper.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 数据库插件
 */
const dbPlugin: Plugin = {
    after: ['logger'],
    async handler(this: Plugin, befly: BeflyContext): Promise<DbHelper | Record<string, never>> {
        let sql: any = null;
        const config = this.config || {};

        try {
            // 默认启用，除非显式禁用
            if (config.enable !== 0) {
                // 创建 Bun SQL 客户端（内置连接池），并确保连接验证成功后再继续
                // 从配置读取连接超时配置
                // const connectionTimeout = config.connectionTimeout ? parseInt(config.connectionTimeout) : 30000;

                sql = await Connect.connectSql(config);

                // 创建数据库管理器实例，直接传入 sql 对象
                const dbManager = new DbHelper(befly, sql);

                return dbManager;
            } else {
                Logger.warn('数据库未启用，跳过初始化');
                return {};
            }
        } catch (error: any) {
            Logger.error('数据库初始化失败', error);

            // 清理资源
            if (sql) {
                try {
                    await sql.close();
                } catch (cleanupError: any) {
                    Logger.error('清理连接池失败:', cleanupError);
                }
            }

            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};

export default dbPlugin;
