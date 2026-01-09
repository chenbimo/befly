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
const dbPlugin: Plugin = {
    name: "db",
    enable: true,
    deps: ["logger", "redis"],
    async handler(befly: BeflyContext): Promise<DbHelper> {
        const env = befly.config?.nodeEnv;

        if (!befly.redis) {
            throw new Error("Redis 未初始化");
        }

        try {
            const sql = Connect.getSql();

            const rawDbType = befly.config?.db?.type;
            const resolvedDbType = rawDbType === "postgres" ? "postgresql" : rawDbType;
            const dialect = getDialectByName(resolvedDbType === "postgresql" || resolvedDbType === "sqlite" ? resolvedDbType : "mysql");

            // 创建数据库管理器实例
            const dbManager = new DbHelper({ redis: befly.redis, sql: sql, dialect: dialect });

            return dbManager;
        } catch (error: unknown) {
            Logger.error({ env: env, err: error, msg: "数据库初始化失败" });
            throw error;
        }
    }
};

export default dbPlugin;
