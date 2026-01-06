/**
 * 数据库插件
 * 初始化数据库连接和 SQL 管理器
 */

import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";

import { Connect } from "../lib/connect";
import { getDialectByName } from "../lib/dbDialect";
import { DbHelper } from "../lib/dbHelper";
import { Logger } from "../lib/logger";

/**
 * 数据库插件
 */
export default {
    name: "db",
    enable: true,
    deps: ["logger", "redis"],
    async handler(befly: BeflyContext): Promise<DbHelper> {
        if (!(befly as any).redis) {
            throw new Error("数据库初始化失败：ctx.redis 未初始化（Redis 插件未加载或注入失败）");
        }

        try {
            const sql = Connect.getSql();

            const rawDbType = befly.config && befly.config.db ? befly.config.db.type : undefined;
            const resolvedDbType = rawDbType === "postgres" ? "postgresql" : rawDbType;
            const dialect = getDialectByName(resolvedDbType === "postgresql" || resolvedDbType === "sqlite" ? resolvedDbType : "mysql");

            // 创建数据库管理器实例
            const dbManager = new DbHelper({ redis: befly.redis, sql: sql, dialect: dialect });

            return dbManager;
        } catch (error: any) {
            Logger.error({ err: error, msg: "数据库初始化失败" });
            throw error;
        }
    }
} satisfies Plugin;
