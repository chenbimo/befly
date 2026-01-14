// 该文件用于 typecheck 阶段的“约束断言”，不会被 build 输出到 dist（tsconfig.build.json 排除了 docs）。
// 目标：确保 syncTable.TestKit 的函数签名不会再接受历史遗留的额外参数（例如旧调用里多出来的第一个参数）。

import type { ColumnInfo } from "../types/sync";
import type { FieldDefinition } from "../types/validate";

import { syncTable } from "../sync/syncTable";

type ExistingColumn = Pick<ColumnInfo, "type" | "columnType" | "max" | "nullable" | "defaultValue" | "comment">;

declare const existingColumn: ExistingColumn;
declare const fieldDef: FieldDefinition;

// compareFieldDefinition: 只能接收 (existingColumn, fieldDef)
void syncTable.TestKit.compareFieldDefinition(existingColumn, fieldDef);
// @ts-expect-error legacy first param must be rejected
void syncTable.TestKit.compareFieldDefinition("mysql", existingColumn, fieldDef);

// quoteIdentifier: 只能接收 (identifier)
void syncTable.TestKit.quoteIdentifier("user");
// @ts-expect-error legacy first param must be rejected
void syncTable.TestKit.quoteIdentifier("mysql", "user");

// buildSystemColumnDefs: 只能接收 ()
void syncTable.TestKit.buildSystemColumnDefs();
// @ts-expect-error should not accept any args
void syncTable.TestKit.buildSystemColumnDefs("mysql");

// getSqlType: 只能接收 (fieldType, fieldMax, unsigned?)
void syncTable.TestKit.getSqlType("string", 100, false);
// @ts-expect-error legacy first param must be rejected
void syncTable.TestKit.getSqlType("mysql", "string", 100);

// buildIndexSQL: 只能接收 (tableName, indexName, fieldName, action)
void syncTable.TestKit.buildIndexSQL("user", "idx_title", "title", "create");
// @ts-expect-error prefixLength is no longer allowed
void syncTable.TestKit.buildIndexSQL("user", "idx_title", "title", "create", 768);
// @ts-expect-error legacy extra param must be rejected
void syncTable.TestKit.buildIndexSQL("mysql", "user", "idx_title", "title", "create");
