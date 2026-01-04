import type { ListSql, SqlInfo } from "../types/database.ts";

export function toSqlLogFields(sqlInfo: SqlInfo): { sqlPreview: string; sqlParams: any[]; sqlDurationMs: number } {
    return {
        sqlPreview: sqlInfo.sql,
        sqlParams: Array.isArray(sqlInfo.params) ? sqlInfo.params : [],
        sqlDurationMs: typeof sqlInfo.duration === "number" ? sqlInfo.duration : 0
    };
}

export function toListSqlLogFields(listSql: ListSql): {
    countSqlPreview: string;
    countSqlParams: any[];
    countSqlDurationMs: number;
    dataSqlPreview?: string;
    dataSqlParams?: any[];
    dataSqlDurationMs?: number;
} {
    const base = {
        countSqlPreview: listSql.count.sql,
        countSqlParams: Array.isArray(listSql.count.params) ? listSql.count.params : [],
        countSqlDurationMs: typeof listSql.count.duration === "number" ? listSql.count.duration : 0
    };

    if (!listSql.data) {
        return base;
    }

    return {
        countSqlPreview: base.countSqlPreview,
        countSqlParams: base.countSqlParams,
        countSqlDurationMs: base.countSqlDurationMs,
        dataSqlPreview: listSql.data.sql,
        dataSqlParams: Array.isArray(listSql.data.params) ? listSql.data.params : [],
        dataSqlDurationMs: typeof listSql.data.duration === "number" ? listSql.data.duration : 0
    };
}
