import type { SqlValue } from "../types/common.ts";
import type { DbResult, SqlInfo } from "../types/database.ts";

import { beforeAll, describe, expect, test } from "bun:test";

import { SQL } from "bun";

import { SqlBuilder } from "../lib/sqlBuilder.ts";
import { SyncTable } from "../sync/syncTable.ts";

function toSqlParams(params?: unknown[]): SqlValue[] {
    if (!Array.isArray(params)) return [];

    const out: SqlValue[] = [];
    for (const p of params) {
        if (p === undefined) {
            out.push("undefined");
            continue;
        }

        if (p === null) {
            out.push(null);
            continue;
        }

        const t = typeof p;
        if (t === "string" || t === "number" || t === "boolean") {
            out.push(p);
            continue;
        }

        if (p instanceof Date) {
            out.push(p);
            continue;
        }

        // 兜底：允许 JSON 对象/数组（用于 smoke 的最小适配器）
        if (t === "object") {
            out.push(p as unknown as SqlValue);
            continue;
        }

        out.push(String(p));
    }

    return out;
}

function readRealMySqlSmokeEnv(): { host: string; port: number; username: string; password: string } | null {
    const enabled = typeof process.env.BEFLY_TEST_REAL_MYSQL === "string" ? process.env.BEFLY_TEST_REAL_MYSQL.trim() : "";
    if (enabled !== "1") return null;

    const host = typeof process.env.BEFLY_TEST_DB_HOST === "string" ? process.env.BEFLY_TEST_DB_HOST.trim() : "";
    const portText = typeof process.env.BEFLY_TEST_DB_PORT === "string" ? process.env.BEFLY_TEST_DB_PORT.trim() : "";
    const username = typeof process.env.BEFLY_TEST_DB_USERNAME === "string" ? process.env.BEFLY_TEST_DB_USERNAME.trim() : "";
    const password = typeof process.env.BEFLY_TEST_DB_PASSWORD === "string" ? process.env.BEFLY_TEST_DB_PASSWORD : "";

    const port = Number(portText);

    if (!host) return null;
    if (!Number.isFinite(port) || port < 1 || port > 65535) return null;
    if (!username) return null;

    return { host: host, port: port, username: username, password: password };
}

function buildMySqlUrl(options: { host: string; port: number; username: string; password: string; database: string }): string {
    const user = encodeURIComponent(options.username);
    const pass = encodeURIComponent(options.password);
    const db = encodeURIComponent(options.database);

    return `mysql://${user}:${pass}@${options.host}:${options.port}/${db}`;
}

describe("smoke - sql", () => {
    test("SqlBuilder: should build a simple SELECT with params", () => {
        const qb = new SqlBuilder();

        const result = qb.select(["id", "name"]).from("users").where({ id: 123 }).limit(10).offset(20).toSelectSql();

        expect(result).toBeDefined();
        expect(typeof result.sql).toBe("string");
        expect(Array.isArray(result.params)).toBe(true);

        // 关键特征：有 SELECT/FROM/WHERE/LIMIT，且参数化生效
        expect(result.sql).toContain("SELECT `id`, `name` FROM `users`");
        expect(result.sql).toContain("WHERE `id` = ?");
        expect(result.sql).toContain("LIMIT 10 OFFSET 20");
        expect(result.params).toEqual([123]);

        // 基础安全性：确保 where 使用占位符，而不是把值直接拼进 SQL
        expect(result.sql).not.toContain("123");
    });
});

describe("smoke - mysql (real) - befly_test", () => {
    const env = readRealMySqlSmokeEnv();

    if (!env) {
        test.skip("跳过：未启用真实 MySQL smoke（设置 BEFLY_TEST_REAL_MYSQL=1，并配置 BEFLY_TEST_DB_HOST/PORT/USERNAME/PASSWORD）", () => {
            // noop
        });
        return;
    }

    // 清理兜底：测试启动时扫描并清理残留表（仅 befly_test 库）
    beforeAll(async () => {
        const url = buildMySqlUrl({ host: env.host, port: env.port, username: env.username, password: env.password, database: "befly_test" });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        try {
            await sql.unsafe("SELECT 1 AS ok");

            const rows = await sql.unsafe("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'befly_test' AND TABLE_NAME LIKE 'befly_smoke\\_%'");

            if (Array.isArray(rows)) {
                for (const row of rows) {
                    const name = typeof (row as any)?.name === "string" ? (row as any).name : "";
                    if (!name) continue;
                    if (!name.startsWith("befly_smoke_")) continue;

                    const quoted = SyncTable.quoteIdentifier(name);
                    await sql.unsafe(`DROP TABLE IF EXISTS ${quoted}`);
                }
            }
        } finally {
            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });

    test("executeDDLSafely: 在真实 MySQL 中可在线优先，必要时可降级（固定 befly_test 库）", async () => {
        const url = buildMySqlUrl({ host: env.host, port: env.port, username: env.username, password: env.password, database: "befly_test" });
        const sql = new SQL({ url: url, max: 1, bigint: false });

        const tableName = `befly_smoke_${Date.now().toString(36)}`;
        const tableQuoted = SyncTable.quoteIdentifier(tableName);
        const colQuoted = SyncTable.quoteIdentifier("a");
        const idxQuoted = SyncTable.quoteIdentifier("idx_a");

        const db = {
            unsafe: async <T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>> => {
                const start = Date.now();
                const p = toSqlParams(params);

                let data: unknown;
                if (p.length > 0) {
                    data = await sql.unsafe(sqlStr, p);
                } else {
                    data = await sql.unsafe(sqlStr);
                }

                return {
                    data: data as T,
                    sql: {
                        sql: sqlStr,
                        params: p,
                        duration: Date.now() - start
                    }
                };
            }
        };

        try {
            // 连接探活
            await sql.unsafe("SELECT 1 AS ok");

            // 固定只操作 befly_test 库：创建一个 MyISAM 表（常见会触发 INPLACE/LOCK=NONE 不兼容场景）
            await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            await sql.unsafe(`CREATE TABLE ${tableQuoted} (${colQuoted} BIGINT NOT NULL DEFAULT 0) ENGINE=MyISAM`);

            const ok = await SyncTable.executeDDLSafely(db, `ALTER TABLE ${tableQuoted} ALGORITHM=INPLACE, LOCK=NONE, ADD INDEX ${idxQuoted} (${colQuoted})`);
            expect(ok).toBe(true);

            const indexCountRes = await db.unsafe<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'befly_test' AND TABLE_NAME = ? AND INDEX_NAME = 'idx_a'", [tableName]);

            const c = Number(indexCountRes.data?.[0]?.c || 0);
            expect(c).toBeGreaterThan(0);
        } finally {
            try {
                await sql.unsafe(`DROP TABLE IF EXISTS ${tableQuoted}`);
            } catch {
                // noop
            }

            try {
                await sql.close();
            } catch {
                // noop
            }
        }
    });
});
