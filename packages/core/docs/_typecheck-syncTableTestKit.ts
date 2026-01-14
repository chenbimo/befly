// 该文件用于 typecheck 阶段的“约束断言”，不会被 build 输出到 dist（tsconfig.build.json 排除了 docs）。
// 目标：确保 syncTable.ts 暴露的静态工具函数存在，并且关键参数类型保持正确。

import type { ColumnInfo } from "../types/sync";
import type { FieldDefinition } from "../types/validate";

import { SyncTable } from "../sync/syncTable";

type ExistingColumn = Pick<ColumnInfo, "type" | "columnType" | "max" | "nullable" | "defaultValue" | "comment">;

declare const existingColumn: ExistingColumn;
declare const fieldDef: FieldDefinition;

// compareFieldDefinition
void SyncTable.compareFieldDefinition(existingColumn, fieldDef);
// @ts-expect-error wrong param types
void SyncTable.compareFieldDefinition("not-a-column", fieldDef);

// quoteIdentifier
void SyncTable.quoteIdentifier("user");
// @ts-expect-error must be string
void SyncTable.quoteIdentifier(123);

// buildSystemColumnDefs
void SyncTable.buildSystemColumnDefs();

// getSqlType
void SyncTable.getSqlType("string", 100, false);
// @ts-expect-error wrong types
void SyncTable.getSqlType("string", "100");

// buildIndexSQL
void SyncTable.buildIndexSQL("user", "idx_title", "title", "create");
// @ts-expect-error wrong action
void SyncTable.buildIndexSQL("user", "idx_title", "title", "legacy");
