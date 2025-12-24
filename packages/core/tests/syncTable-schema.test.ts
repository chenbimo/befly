/**
 * syncTable 表结构查询模块集成测试（真实入库）
 *
 * 约束：
 * - 固定数据库名：befly_test
 * - 其他连接参数（host/port/username/password/redis）均来自 beflyConfig
 * - 不使用 mock，不伪造 SQL 返回
 */

import type { DbDialectName } from "../lib/dbDialect.js";

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import { beflyConfig } from "../befly.config.js";
import { Connect } from "../lib/connect.js";
import { RedisHelper } from "../lib/redisHelper.js";
import { syncTable } from "../sync/syncTable.js";

let originalDbName = "";
let originalRedisPrefix = "";
let sql: any = null;
let redis: RedisHelper | null = null;
let dialect: DbDialectName = "mysql";

const cleanupTables: string[] = [];

function resolveDialect(): DbDialectName {
    const t = String(beflyConfig.db?.type || "mysql").toLowerCase();
    if (t === "postgres" || t === "postgresql") return "postgresql";
    if (t === "sqlite") return "sqlite";
    return "mysql";
}

async function dropTable(tableName: string): Promise<void> {
    const quoted = syncTable.TestKit.quoteIdentifier(dialect, tableName);
    if (dialect === "postgresql") {
        await sql.unsafe(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
        return;
    }
    await sql.unsafe(`DROP TABLE IF EXISTS ${quoted}`);
}

async function createSchemaTestTable(tableName: string): Promise<void> {
    const quoted = syncTable.TestKit.quoteIdentifier(dialect, tableName);
    const colId = syncTable.TestKit.quoteIdentifier(dialect, "id");
    const colUserName = syncTable.TestKit.quoteIdentifier(dialect, "user_name");
    const colUserId = syncTable.TestKit.quoteIdentifier(dialect, "user_id");
    const colAge = syncTable.TestKit.quoteIdentifier(dialect, "age");
    const colCreatedAt = syncTable.TestKit.quoteIdentifier(dialect, "created_at");

    if (dialect === "mysql") {
        await sql.unsafe(
            `CREATE TABLE ${quoted} (
                ${colId} BIGINT NOT NULL,
                ${colUserName} VARCHAR(50) NOT NULL DEFAULT '',
                ${colUserId} BIGINT NOT NULL DEFAULT 0,
                ${colAge} BIGINT NULL DEFAULT 0,
                ${colCreatedAt} BIGINT NOT NULL DEFAULT 0,
                PRIMARY KEY (${colId})
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        );
        return;
    }

    if (dialect === "postgresql") {
        await sql.unsafe(
            `CREATE TABLE ${quoted} (
                ${colId} BIGINT NOT NULL,
                ${colUserName} varchar(50) NOT NULL DEFAULT '',
                ${colUserId} BIGINT NOT NULL DEFAULT 0,
                ${colAge} BIGINT NULL DEFAULT 0,
                ${colCreatedAt} BIGINT NOT NULL DEFAULT 0,
                PRIMARY KEY (${colId})
            )`
        );
        return;
    }

    // sqlite
    await sql.unsafe(
        `CREATE TABLE ${quoted} (
            ${colId} INTEGER NOT NULL PRIMARY KEY,
            ${colUserName} TEXT NOT NULL DEFAULT '',
            ${colUserId} INTEGER NOT NULL DEFAULT 0,
            ${colAge} INTEGER NULL DEFAULT 0,
            ${colCreatedAt} INTEGER NOT NULL DEFAULT 0
        )`
    );
}

async function createSchemaTestIndexes(tableName: string): Promise<void> {
    const quoted = syncTable.TestKit.quoteIdentifier(dialect, tableName);
    const colUserName = syncTable.TestKit.quoteIdentifier(dialect, "user_name");
    const colUserId = syncTable.TestKit.quoteIdentifier(dialect, "user_id");
    const colCreatedAt = syncTable.TestKit.quoteIdentifier(dialect, "created_at");

    // 单列索引
    await sql.unsafe(`CREATE INDEX idx_user_name ON ${quoted} (${colUserName})`);
    await sql.unsafe(`CREATE INDEX idx_created_at ON ${quoted} (${colCreatedAt})`);

    // 复合索引
    await sql.unsafe(`CREATE INDEX idx_composite ON ${quoted} (${colUserId}, ${colCreatedAt})`);
}

beforeAll(async () => {
    if (!beflyConfig.db) {
        throw new Error("syncTable-schema 集成测试需要 beflyConfig.db");
    }
    if (!beflyConfig.redis) {
        throw new Error("syncTable-schema 集成测试需要 beflyConfig.redis");
    }

    dialect = resolveDialect();

    originalDbName = String(beflyConfig.db.database || "");
    originalRedisPrefix = String(beflyConfig.redis.prefix || "");

    // 固定数据库名 befly_test（账号密码等仍来自配置）
    beflyConfig.db.database = "befly_test";
    // Redis 前缀也跟随测试库，避免污染默认前缀
    beflyConfig.redis.prefix = "befly_test";

    try {
        sql = await Connect.connectSql();
    } catch (error: any) {
        const dbType = String(beflyConfig.db.type || "");
        const host = String((beflyConfig.db as any).host || "");
        const port = String((beflyConfig.db as any).port || "");
        const username = String((beflyConfig.db as any).username || "");
        throw new Error(
            [
                "syncTable-schema: Connect.connectSql() 失败（真实入库测试需要可用数据库）",
                `db.type=${dbType} host=${host} port=${port} username=${username} database=befly_test`,
                "请确认：已创建数据库 befly_test，且当前账号拥有 CREATE/DROP/INDEX 等权限。",
                `原始错误: ${String(error?.message || error)}`
            ].join("\n")
        );
    }

    try {
        await Connect.connectRedis();
    } catch (error: any) {
        const redisHost = String((beflyConfig.redis as any).host || "");
        const redisPort = String((beflyConfig.redis as any).port || "");
        throw new Error(["syncTable-schema: Connect.connectRedis() 失败（真实入库测试需要可用 Redis）", `redis.host=${redisHost} redis.port=${redisPort} prefix=befly_test`, "请确认：Redis 可连接，且当前配置指向正确实例。", `原始错误: ${String(error?.message || error)}`].join("\n"));
    }

    redis = new RedisHelper(String(beflyConfig.redis.prefix || ""));

    // 轻量健康检查（确保真连接建立）
    try {
        await sql.unsafe("SELECT 1 as ok");
    } catch (error: any) {
        throw new Error(["syncTable-schema: SQL 健康检查失败（SELECT 1）", "请确认 befly_test 存在且账号具备连接/查询权限。", `原始错误: ${String(error?.message || error)}`].join("\n"));
    }

    try {
        await redis.setString("syncTable_test:ping", "1", 5);
    } catch (error: any) {
        throw new Error(["syncTable-schema: Redis 健康检查失败（SET）", "请确认 Redis 可写入（至少允许 SET/EXPIRE）。", `原始错误: ${String(error?.message || error)}`].join("\n"));
    }
});

afterEach(async () => {
    if (!sql) return;

    const items = cleanupTables.splice(0, cleanupTables.length);
    for (const tableName of items) {
        try {
            await dropTable(tableName);
        } catch {
            // 清理兜底：忽略（表可能不存在或权限不足），避免影响主断言
        }
    }
});

afterAll(async () => {
    try {
        await Connect.disconnect();
    } finally {
        if (beflyConfig.db) {
            beflyConfig.db.database = originalDbName;
        }
        if (beflyConfig.redis) {
            beflyConfig.redis.prefix = originalRedisPrefix;
        }
        Connect.__reset();
    }
});

describe("tableExistsRuntime", () => {
    test("sql 执行器未初始化时抛出错误", async () => {
        try {
            await syncTable.TestKit.tableExistsRuntime(syncTable.TestKit.createRuntime(dialect, null as any, "befly_test"), "user");
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error.message).toBe("SQL 执行器未初始化");
        }
    });

    test("真实数据库：表存在返回 true；表不存在返回 false", async () => {
        const tableName = "test_sync_table_exists";
        cleanupTables.push(tableName);
        await dropTable(tableName);
        await createSchemaTestTable(tableName);

        const runtime = syncTable.TestKit.createRuntime(dialect, sql as any, "befly_test");

        const exist = await syncTable.TestKit.tableExistsRuntime(runtime, tableName);
        expect(exist).toBe(true);

        const notExist = await syncTable.TestKit.tableExistsRuntime(runtime, "test_sync_table_not_exist_12345");
        expect(notExist).toBe(false);

        await dropTable(tableName);
    });
});

describe("getTableColumnsRuntime", () => {
    test("真实数据库：返回列信息结构（至少包含我们创建的列）", async () => {
        const tableName = "test_sync_table_columns";
        cleanupTables.push(tableName);
        await dropTable(tableName);
        await createSchemaTestTable(tableName);

        const runtime = syncTable.TestKit.createRuntime(dialect, sql as any, "befly_test");
        const columns = await syncTable.TestKit.getTableColumnsRuntime(runtime, tableName);

        expect(columns.id).toBeDefined();
        expect(columns.user_name).toBeDefined();
        expect(columns.user_id).toBeDefined();
        expect(columns.age).toBeDefined();
        expect(columns.created_at).toBeDefined();

        expect(columns.user_name.nullable).toBe(false);

        await dropTable(tableName);
    });
});

describe("getTableIndexesRuntime", () => {
    test("真实数据库：返回索引信息结构（包含单列索引与复合索引）", async () => {
        const tableName = "test_sync_table_indexes";
        cleanupTables.push(tableName);
        await dropTable(tableName);
        await createSchemaTestTable(tableName);
        await createSchemaTestIndexes(tableName);

        const runtime = syncTable.TestKit.createRuntime(dialect, sql as any, "befly_test");
        const indexes = await syncTable.TestKit.getTableIndexesRuntime(runtime, tableName);

        expect(indexes.idx_created_at).toBeDefined();
        expect(indexes.idx_created_at).toContain("created_at");

        expect(indexes.idx_user_name).toBeDefined();
        expect(indexes.idx_user_name).toContain("user_name");

        expect(indexes.idx_composite).toBeDefined();
        expect(indexes.idx_composite.length).toBe(2);
        expect(indexes.idx_composite).toContain("user_id");
        expect(indexes.idx_composite).toContain("created_at");

        await dropTable(tableName);
    });
});
