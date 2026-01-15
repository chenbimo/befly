import type { FieldDefinition } from "../types/validate.ts";
import type { ScanFileResult } from "../utils/scanFiles.ts";
import type { MockMySqlState } from "./_mocks/mockMySqlDb.ts";

import { describe, expect, test } from "bun:test";

import { Logger } from "../lib/logger.ts";
import { SyncTable } from "../sync/syncTable.ts";
import { snakeCase } from "../utils/util.ts";
import { createMockMySqlDb } from "./_mocks/mockMySqlDb.ts";

describe("syncTable - logging summary", () => {
    const getMsgFromArgs = (args: unknown[]): string => {
        const first = args[0];

        if (typeof first === "string") {
            return first;
        }

        if (typeof first === "object" && first !== null) {
            const record = first as any;
            if (typeof record.msg === "string") {
                return record.msg;
            }
            if (typeof record.value === "string") {
                return record.value;
            }
            try {
                return JSON.stringify(record);
            } catch {
                return String(record);
            }
        }

        return String(first);
    };

    test("每张表仅打印一条变更汇总日志（不逐条字段/索引刷屏）", async () => {
        const calls: Array<{ level: string; args: unknown[] }> = [];
        const mockLogger = {
            info(...args: unknown[]) {
                calls.push({ level: "info", args: args });
            },
            warn(...args: unknown[]) {
                calls.push({ level: "warn", args: args });
            },
            error(...args: unknown[]) {
                calls.push({ level: "error", args: args });
            },
            debug(...args: unknown[]) {
                calls.push({ level: "debug", args: args });
            }
        } as any;

        // 让 debug 输出可被捕获（Logger.debug 需要 debug=1）
        Logger.configure({ debug: 1, console: 0, dir: "./logs" });
        Logger.setMock(mockLogger);

        try {
            const fileName = "testSyncTableLogSummary";
            const tableName = snakeCase(fileName);

            const state: MockMySqlState = {
                executedSql: [],
                dbName: "test",
                tables: {
                    [tableName]: {
                        columns: {
                            id: { name: "id", dataType: "bigint", columnType: "bigint unsigned", max: null, nullable: false, defaultValue: null, comment: "主键ID" },
                            created_at: { name: "created_at", dataType: "bigint", columnType: "bigint unsigned", max: null, nullable: false, defaultValue: 0, comment: "创建时间" },
                            updated_at: { name: "updated_at", dataType: "bigint", columnType: "bigint unsigned", max: null, nullable: false, defaultValue: 0, comment: "更新时间" },
                            deleted_at: { name: "deleted_at", dataType: "bigint", columnType: "bigint unsigned", max: null, nullable: false, defaultValue: 0, comment: "删除时间" },
                            state: { name: "state", dataType: "bigint", columnType: "bigint unsigned", max: null, nullable: false, defaultValue: 1, comment: "状态字段" },

                            nickname: { name: "nickname", dataType: "varchar", columnType: "varchar(50)", max: 50, nullable: false, defaultValue: "", comment: "昵称" }
                        },
                        indexes: {
                            idx_created_at: ["created_at"],
                            idx_updated_at: ["updated_at"],
                            idx_state: ["state"]
                        }
                    }
                }
            };

            const db = createMockMySqlDb(state);
            const ctx = {
                db: db,
                config: {
                    db: { database: "test" }
                }
            } satisfies ConstructorParameters<typeof SyncTable>[0];

            const item: ScanFileResult = {
                type: "table",
                source: "app",
                sourceName: "项目",
                filePath: "DUMMY",
                relativePath: fileName,
                fileName: fileName,
                moduleName: `app_${fileName}`,
                addonName: "",
                content: {
                    nickname: { name: "昵称", type: "string", min: 0, max: 100, default: null, nullable: false, index: true, unique: false } satisfies FieldDefinition,
                    bio: { name: "简介", type: "text", min: null, max: null, default: null, nullable: true, index: false, unique: false } satisfies FieldDefinition
                }
            } as any;

            await new SyncTable(ctx).run([item]);

            const debugMessages = calls.filter((c) => c.level === "debug").map((c) => getMsgFromArgs(c.args));
            const tableSummaries = debugMessages.filter((m) => m.includes(`[表 ${tableName}]`) && m.includes("变更汇总"));

            expect(tableSummaries.length).toBe(1);

            // 附加断言：不应出现按字段/索引逐条输出的旧格式（防回归）
            expect(debugMessages.some((m) => m.includes("[字段变更]"))).toBe(false);
            expect(debugMessages.some((m) => m.includes("[索引变更]"))).toBe(false);
        } finally {
            Logger.setMock(null);
            Logger.configure({ debug: 0, console: 0, dir: "./logs" });
        }
    });
});
