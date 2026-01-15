import type { SqlValue } from "../types/common.ts";
import type { DbResult, SqlInfo } from "../types/database.ts";
import type { TablePlan } from "../types/sync.ts";

import { describe, expect, test } from "bun:test";

import { SyncTable } from "../sync/syncTable.ts";

type SqlExecutor = {
    unsafe<T = unknown>(sqlStr: string, params?: unknown[]): Promise<DbResult<T, SqlInfo>>;
};

function okResult<T>(data: T): DbResult<T, SqlInfo> {
    const params: SqlValue[] = [];
    return {
        data: data,
        sql: {
            sql: "",
            params: params,
            duration: 0
        }
    };
}

describe("executeDDLSafely", () => {
    test("buildDdlFallbackCandidates: INSTANT 应生成 INPLACE + COPY + strip 三个候选（去重、保持顺序）", () => {
        const stmt = "ALTER TABLE `t` ALGORITHM=INSTANT, LOCK=NONE, ADD COLUMN `a` BIGINT NOT NULL DEFAULT 0";
        const candidates = SyncTable.buildDdlFallbackCandidates(stmt);

        expect(candidates.length).toBe(3);
        expect(candidates[0]?.stmt.includes("ALGORITHM=INPLACE")).toBe(true);
        expect(candidates[0]?.stmt.includes("LOCK=NONE")).toBe(true);
        expect(candidates[0]?.reason).toContain("INSTANT");

        expect(candidates[1]?.stmt.includes("ALGORITHM=COPY")).toBe(true);
        expect(candidates[1]?.stmt.includes("LOCK=NONE")).toBe(true);
        expect(candidates[1]?.reason).toContain("INSTANT");

        expect(candidates[2]?.stmt.includes("ALGORITHM=")).toBe(false);
        expect(candidates[2]?.stmt.includes("LOCK=")).toBe(false);
        expect(candidates[2]?.reason).toContain("移除");
    });

    test("buildDdlFallbackCandidates: 仅 INPLACE 时只应生成 strip 候选", () => {
        const stmt = "ALTER TABLE `t` ALGORITHM=INPLACE, LOCK=NONE, ADD INDEX `idx_a` (`a`)";
        const candidates = SyncTable.buildDdlFallbackCandidates(stmt);

        expect(candidates.length).toBe(2);

        expect(candidates[0]?.stmt.includes("ALGORITHM=COPY")).toBe(true);
        expect(candidates[0]?.stmt.includes("LOCK=NONE")).toBe(true);

        expect(candidates[1]?.stmt.includes("ALGORITHM=")).toBe(false);
        expect(candidates[1]?.stmt.includes("LOCK=")).toBe(false);
    });

    test("当 INPLACE 不支持时，先降级 COPY，再不行则去掉 ALGORITHM/LOCK", async () => {
        const calls: string[] = [];

        const db: SqlExecutor = {
            unsafe: async <T = unknown>(sqlStr: string) => {
                const sql = String(sqlStr);
                calls.push(sql);

                if (sql.includes("ALGORITHM=INPLACE")) {
                    throw new Error("SQL执行失败: ALGORITHM=INPLACE is not supported for this operation. Try ALGORITHM=COPY.");
                }

                if (sql.includes("ALGORITHM=COPY")) {
                    throw new Error("SQL执行失败: ALGORITHM=COPY is not supported for this operation.");
                }

                return okResult<T>([] as unknown as T);
            }
        };

        const stmt = "ALTER TABLE `t` ALGORITHM=INPLACE, LOCK=NONE, ADD INDEX `idx_a` (`a`)";
        const ok = await SyncTable.executeDDLSafely(db, stmt);

        expect(ok).toBe(true);
        expect(calls.length).toBe(3);
        expect(calls[0]?.includes("ALGORITHM=INPLACE")).toBe(true);
        expect(calls[1]?.includes("ALGORITHM=COPY")).toBe(true);
        expect(calls[2]?.includes("ALGORITHM=")).toBe(false);
        expect(calls[2]?.includes("LOCK=")).toBe(false);
        expect(calls[2]?.includes("ADD INDEX")).toBe(true);
        expect(calls[2]?.includes("idx_a")).toBe(true);
    });

    test("INSTANT 失败时按顺序降级：INPLACE -> COPY -> strip", async () => {
        const calls: string[] = [];

        const db: SqlExecutor = {
            unsafe: async <T = unknown>(sqlStr: string) => {
                const sql = String(sqlStr);
                calls.push(sql);

                if (sql.includes("ALGORITHM=INSTANT")) {
                    throw new Error("SQL执行失败: ALGORITHM=INSTANT is not supported for this operation.");
                }

                if (sql.includes("ALGORITHM=INPLACE")) {
                    throw new Error("SQL执行失败: ALGORITHM=INPLACE is not supported for this operation. Try ALGORITHM=COPY.");
                }

                if (sql.includes("ALGORITHM=COPY")) {
                    throw new Error("SQL执行失败: ALGORITHM=COPY is not supported for this operation.");
                }

                return okResult<T>([] as unknown as T);
            }
        };

        const stmt = "ALTER TABLE `t` ALGORITHM=INSTANT, LOCK=NONE, ADD COLUMN `a` BIGINT NOT NULL DEFAULT 0";
        const ok = await SyncTable.executeDDLSafely(db, stmt);

        expect(ok).toBe(true);
        expect(calls.length).toBe(4);
        expect(calls[0]?.includes("ALGORITHM=INSTANT")).toBe(true);
        expect(calls[1]?.includes("ALGORITHM=INPLACE")).toBe(true);
        expect(calls[2]?.includes("ALGORITHM=COPY")).toBe(true);
        expect(calls[3]?.includes("ALGORITHM=")).toBe(false);
        expect(calls[3]?.includes("LOCK=")).toBe(false);
    });

    test("INSTANT/INPLACE 不支持但 COPY 可用时，应在 COPY 成功后停止", async () => {
        const calls: string[] = [];

        const db: SqlExecutor = {
            unsafe: async <T = unknown>(sqlStr: string) => {
                const sql = String(sqlStr);
                calls.push(sql);

                if (sql.includes("ALGORITHM=INSTANT")) {
                    throw new Error("SQL执行失败: ALGORITHM=INSTANT is not supported for this operation. Try ALGORITHM=COPY/INPLACE.");
                }

                if (sql.includes("ALGORITHM=INPLACE")) {
                    throw new Error("SQL执行失败: ALGORITHM=INPLACE is not supported for this operation. Try ALGORITHM=COPY.");
                }

                // COPY succeeds
                return okResult<T>([] as unknown as T);
            }
        };

        const stmt = "ALTER TABLE `t` ALGORITHM=INSTANT, LOCK=NONE, ADD COLUMN `a` BIGINT NOT NULL DEFAULT 0";
        const ok = await SyncTable.executeDDLSafely(db, stmt);

        expect(ok).toBe(true);
        expect(calls.length).toBe(3);
        expect(calls[0]?.includes("ALGORITHM=INSTANT")).toBe(true);
        expect(calls[1]?.includes("ALGORITHM=INPLACE")).toBe(true);
        expect(calls[2]?.includes("ALGORITHM=COPY")).toBe(true);
    });
});

describe("applyTablePlan - batch indexes", () => {
    test("索引 create 动作应批量执行，并在 INPLACE 不支持时降级", async () => {
        const calls: string[] = [];

        const db: SqlExecutor = {
            unsafe: async <T = unknown>(sqlStr: string) => {
                const sql = String(sqlStr);
                calls.push(sql);

                if (sql.includes("ALGORITHM=INPLACE")) {
                    throw new Error("SQL执行失败: ALGORITHM=INPLACE is not supported for this operation. Try ALGORITHM=COPY.");
                }

                return okResult<T>([] as unknown as T);
            }
        };

        const plan: TablePlan = {
            changed: true,
            addClauses: [],
            modifyClauses: [],
            defaultClauses: [],
            indexActions: [
                { action: "create", indexName: "idx_created_at", fieldName: "created_at" },
                { action: "create", indexName: "idx_user_name", fieldName: "user_name" }
            ]
        };

        await SyncTable.applyTablePlan(db, "t", plan);

        // 1 次批量语句 + 1 次降级重试
        expect(calls.length).toBe(2); // 1 次批量语句 + 1 次降级重试（INPLACE -> COPY）
        expect(calls[0]?.includes("ALTER TABLE `t`")).toBe(true);
        expect(calls[0]?.includes("ALGORITHM=INPLACE")).toBe(true);
        expect(calls[0]?.includes("ADD INDEX `idx_created_at` (`created_at`)")).toBe(true);
        expect(calls[0]?.includes("ADD INDEX `idx_user_name` (`user_name`)")).toBe(true);

        expect(calls[1]?.includes("ALGORITHM=COPY")).toBe(true);
        expect(calls[1]?.includes("LOCK=NONE")).toBe(true);
        expect(calls[1]?.includes("ADD INDEX `idx_created_at` (`created_at`)")).toBe(true);
        expect(calls[1]?.includes("ADD INDEX `idx_user_name` (`user_name`)")).toBe(true);
    });
});
