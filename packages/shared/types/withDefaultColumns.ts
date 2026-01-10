export type TableColumnLike = Record<string, unknown>;

export type WithDefaultColumns = (columns: Array<TableColumnLike>, customConfig?: Record<string, Record<string, unknown>>) => Array<Record<string, unknown>>;
