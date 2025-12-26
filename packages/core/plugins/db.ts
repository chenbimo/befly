/**
 * 数据库插件
 * 初始化数据库连接和 SQL 管理器
 */

import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";

import { Connect } from "../lib/connect.js";
import { MySqlDialect } from "../lib/dbDialect.js";
import { DbHelper } from "../lib/dbHelper.js";
import { Logger } from "../lib/logger.js";

/**
 * 数据库插件
 */
export default {
    deps: ["logger", "redis"],
    async handler(befly: BeflyContext): Promise<DbHelper> {
        let sql: any = null;

        if (!(befly as any).redis) {
            throw new Error("数据库初始化失败：ctx.redis 未初始化（Redis 插件未加载或注入失败）");
        }

        try {
            sql = await Connect.connectSql(befly.config ? befly.config.db : undefined);

            // 创建数据库管理器实例
            const dbManager = new DbHelper({ redis: befly.redis, sql: sql, dialect: new MySqlDialect() });

            return dbManager;
        } catch (error: any) {
            Logger.error({ err: error }, "数据库初始化失败");

            // 清理资源
            if (sql) {
                try {
                    await sql.close();
                } catch (cleanupError: any) {
                    Logger.error({ err: cleanupError }, "清理连接池失败");
                }
            }

            throw error;
        }
    }
} satisfies Plugin;
