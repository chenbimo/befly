/**
 * 数据库插件
 * 初始化数据库连接和 SQL 管理器
 */

import { Logger } from '../lib/logger.js';
import { Connect } from '../lib/connect.js';
import { DbHelper } from '../lib/dbHelper.js';
import { config } from '../config.js';

import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 数据库插件
 */
const dbPlugin: Plugin = {
    after: ['logger'],
    async handler(befly: BeflyContext): Promise<DbHelper> {
        let sql: any = null;

        try {
            sql = await Connect.connectSql(config.db || {});

            // 创建数据库管理器实例，直接传入 sql 对象
            const dbManager = new DbHelper(befly, sql);

            return dbManager;
        } catch (error: any) {
            Logger.error({ err: error }, '数据库初始化失败');

            // 清理资源
            if (sql) {
                try {
                    await sql.close();
                } catch (cleanupError: any) {
                    Logger.error({ err: cleanupError }, '清理连接池失败');
                }
            }

            throw error;
        }
    }
};

export default dbPlugin;
