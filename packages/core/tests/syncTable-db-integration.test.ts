/**
 * syncTable 真·入库集成测试（真实同步）
 *
 * 约束：
 * - 固定数据库名：befly_test
 * - 其他连接参数（host/port/username/password/redis）均来自 beflyConfig
 * - 不使用 mock，不伪造 SQL 返回
 */

import type { BeflyContext } from "../types/befly.js";
import type { FieldDefinition } from "../types/validate.js";
import type { ScanFileResult } from "../utils/scanFiles.js";

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { beflyConfig } from "../befly.config.js";
import { Connect } from "../lib/connect.js";
import { RedisHelper } from "../lib/redisHelper.js";
import { syncTable } from "../sync/syncTable.js";

const RUN_REAL_DB = process.env.BEFLY_TEST_REAL_DB === "1";

let originalDbName = "";
let originalRedisPrefix = "";
let sql: any = null;
let redis: RedisHelper | null = null;
let ctx: BeflyContext | null = null;

function resolveDialect(): "mysql" | "postgresql" | "sqlite" {
    const t = String(beflyConfig.db?.type || "mysql").toLowerCase();
    if (t === "postgres" || t === "postgresql") return "postgresql";
    if (t === "sqlite") return "sqlite";
    return "mysql";
}

async function dropTable(dialect: "mysql" | "postgresql" | "sqlite", tableName: string): Promise<void> {
    const quoted = syncTable.TestKit.quoteIdentifier(dialect, tableName);
    if (dialect === "postgresql") {
        await sql.unsafe(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
        return;
    }
    await sql.unsafe(`DROP TABLE IF EXISTS ${quoted}`);
}

function buildTableItem(options: { tableFileName: string; content: any }): ScanFileResult {
    // ScanFileResult 字段较多，这里只构造 syncTable 实际会用到的字段，其余字段用于满足类型
    return {
        source: "app",
        type: "table",
        sourceName: "项目",
        filePath: "",
        relativePath: options.tableFileName,
        fileName: options.tableFileName,
        moduleName: `app_${options.tableFileName}`,
        fileBaseName: "",
        fileDir: "",
        content: options.content
    } as any;
}

function fdString(options: { name: string; min: number; max: number; defaultValue: any; nullable: boolean }): FieldDefinition {
    // 仅提供最小字段集合：其余字段由 syncTable 内部 applyFieldDefaults 补齐
    return {
        name: options.name,
        type: "string",
        min: options.min,
        max: options.max,
        default: options.defaultValue,
        nullable: options.nullable
    } as any;
}

function fdNumber(options: { name: string; min: number; max: number; defaultValue: any; nullable: boolean }): FieldDefinition {
    return {
        name: options.name,
        type: "number",
        min: options.min,
        max: options.max,
        default: options.defaultValue,
        nullable: options.nullable
    } as any;
}

function fdText(options: { name: string; min: number; max: number; defaultValue: any; nullable: boolean }): FieldDefinition {
    return {
        name: options.name,
        type: "text",
        min: options.min,
        max: options.max,
        default: options.defaultValue,
        nullable: options.nullable
    } as any;
}

if (!RUN_REAL_DB) {
    describe.skip("syncTable(ctx, items) - 真实同步入库", () => {});
} else {
    beforeAll(async () => {
        if (!beflyConfig.db) {
            throw new Error("syncTable-db-integration 集成测试需要 beflyConfig.db");
        }
        if (!beflyConfig.redis) {
            throw new Error("syncTable-db-integration 集成测试需要 beflyConfig.redis");
        }

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
                    "syncTable-db-integration: Connect.connectSql() 失败（真实入库测试需要可用数据库）",
                    `db.type=${dbType} host=${host} port=${port} username=${username} database=befly_test`,
                    "请确认：已创建数据库 befly_test，且当前账号拥有 CREATE/DROP/ALTER/INDEX 权限。",
                    `原始错误: ${String(error?.message || error)}`
                ].join("\n")
            );
        }

        try {
            await Connect.connectRedis();
        } catch (error: any) {
            const redisHost = String((beflyConfig.redis as any).host || "");
            const redisPort = String((beflyConfig.redis as any).port || "");
            throw new Error(["syncTable-db-integration: Connect.connectRedis() 失败（真实入库测试需要可用 Redis）", `redis.host=${redisHost} redis.port=${redisPort} prefix=befly_test`, "请确认：Redis 可连接，且当前配置指向正确实例。", `原始错误: ${String(error?.message || error)}`].join("\n"));
        }

        redis = new RedisHelper(String(beflyConfig.redis.prefix || ""));

        ctx = {
            db: sql,
            redis: redis,
            config: beflyConfig
        } as any;

        try {
            await sql.unsafe("SELECT 1 as ok");
        } catch (error: any) {
            throw new Error(["syncTable-db-integration: SQL 健康检查失败（SELECT 1）", "请确认 befly_test 存在且账号具备连接/查询权限。", `原始错误: ${String(error?.message || error)}`].join("\n"));
        }

        try {
            await redis.setString("syncTable_test:ping", "1", 5);
        } catch (error: any) {
            throw new Error(["syncTable-db-integration: Redis 健康检查失败（SET）", "请确认 Redis 可写入（至少允许 SET/EXPIRE）。", `原始错误: ${String(error?.message || error)}`].join("\n"));
        }
    });

    // 约束：每个用例开始前清理；用例结束后不清理（保留表与数据用于人工检查）。
    beforeEach(async () => {
        if (!sql) return;
        const dialect = resolveDialect();

        try {
            await dropTable(dialect, "test_sync_table_integration_user");
        } catch {}
        try {
            await dropTable(dialect, "test_sync_table_integration_profile");
        } catch {}
        try {
            await dropTable(dialect, "test_sync_table_integration_data");
        } catch {}
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

    describe("syncTable(ctx, items) - 真实同步入库", () => {
        test("首次同步：应创建表并包含系统字段 + 业务字段", async () => {
            const dialect = resolveDialect();
            const tableFileName = "test_sync_table_integration_user";
            const tableName = tableFileName; // snakeCase 后仍为下划线

            const item = buildTableItem({
                tableFileName: tableFileName,
                content: {
                    email: fdString({ name: "邮箱", min: 0, max: 100, defaultValue: null, nullable: false }),
                    nickname: fdString({ name: "昵称", min: 0, max: 50, defaultValue: "用户", nullable: true }),
                    age: fdNumber({ name: "年龄", min: 0, max: 999, defaultValue: 0, nullable: true })
                }
            });

            await syncTable(ctx as any, [item]);

            const runtime = syncTable.TestKit.createRuntime(dialect, sql as any, "befly_test");
            const exists = await syncTable.TestKit.tableExistsRuntime(runtime, tableName);
            expect(exists).toBe(true);

            const columns = await syncTable.TestKit.getTableColumnsRuntime(runtime, tableName);

            // 系统字段
            expect(columns.id).toBeDefined();
            expect(columns.created_at).toBeDefined();
            expect(columns.updated_at).toBeDefined();
            expect(columns.state).toBeDefined();

            // 业务字段
            expect(columns.email).toBeDefined();
            expect(columns.nickname).toBeDefined();
            expect(columns.age).toBeDefined();
        });

        test("二次同步：新增字段应落库（ALTER/重建）", async () => {
            const dialect = resolveDialect();
            const tableFileName = "test_sync_table_integration_profile";
            const tableName = tableFileName;

            const itemV1 = buildTableItem({
                tableFileName: tableFileName,
                content: {
                    nickname: fdString({ name: "昵称", min: 0, max: 50, defaultValue: "用户", nullable: true })
                }
            });

            await syncTable(ctx as any, [itemV1]);

            const itemV2 = buildTableItem({
                tableFileName: tableFileName,
                content: {
                    nickname: fdString({ name: "昵称", min: 0, max: 50, defaultValue: "用户", nullable: true }),
                    bio: fdText({ name: "简介", min: 0, max: 200, defaultValue: null, nullable: true })
                }
            });

            await syncTable(ctx as any, [itemV2]);

            const runtime = syncTable.TestKit.createRuntime(dialect, sql as any, "befly_test");
            const columns = await syncTable.TestKit.getTableColumnsRuntime(runtime, tableName);
            expect(columns.nickname).toBeDefined();
            expect(columns.bio).toBeDefined();
        });

        test("写入数据：同步建表后应可真实入库并查询", async () => {
            const dialect = resolveDialect();
            const tableFileName = "test_sync_table_integration_data";
            const tableName = tableFileName;

            const item = buildTableItem({
                tableFileName: tableFileName,
                content: {
                    email: fdString({ name: "邮箱", min: 0, max: 100, defaultValue: null, nullable: false }),
                    nickname: fdString({ name: "昵称", min: 0, max: 50, defaultValue: "用户", nullable: true }),
                    age: fdNumber({ name: "年龄", min: 0, max: 999, defaultValue: 0, nullable: true })
                }
            });

            await syncTable(ctx as any, [item]);

            const runtime = syncTable.TestKit.createRuntime(dialect, sql as any, "befly_test");
            const exists = await syncTable.TestKit.tableExistsRuntime(runtime, tableName);
            expect(exists).toBe(true);

            const quotedTable = syncTable.TestKit.quoteIdentifier(dialect, tableName);
            const colId = syncTable.TestKit.quoteIdentifier(dialect, "id");
            const colEmail = syncTable.TestKit.quoteIdentifier(dialect, "email");
            const colNickname = syncTable.TestKit.quoteIdentifier(dialect, "nickname");
            const colAge = syncTable.TestKit.quoteIdentifier(dialect, "age");
            const colCreatedAt = syncTable.TestKit.quoteIdentifier(dialect, "created_at");
            const colUpdatedAt = syncTable.TestKit.quoteIdentifier(dialect, "updated_at");
            const colDeletedAt = syncTable.TestKit.quoteIdentifier(dialect, "deleted_at");
            const colState = syncTable.TestKit.quoteIdentifier(dialect, "state");

            const id = 1001;
            const email = "data_write@test.com";
            const nickname = "写入测试";
            const age = 18;
            const now = Date.now();

            const insertSql = `INSERT INTO ${quotedTable} (${colId}, ${colEmail}, ${colNickname}, ${colAge}, ${colCreatedAt}, ${colUpdatedAt}, ${colDeletedAt}, ${colState}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            await sql.unsafe(insertSql, [id, email, nickname, age, now, now, 0, 1]);

            const selectSql = `SELECT ${colId} AS id, ${colEmail} AS email, ${colNickname} AS nickname, ${colAge} AS age, ${colState} AS state FROM ${quotedTable} WHERE ${colId} = ?`;
            const rows = await sql.unsafe(selectSql, [id]);

            expect(Array.isArray(rows)).toBe(true);
            expect(rows.length).toBe(1);

            expect(Number(rows[0].id)).toBe(id);
            expect(String(rows[0].email)).toBe(email);
            expect(String(rows[0].nickname)).toBe(nickname);
            expect(Number(rows[0].age)).toBe(age);
            expect(Number(rows[0].state)).toBe(1);
        });
    });
}
