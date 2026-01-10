export type TableColumnLike = Record<string, unknown>;

/**
 * 为表格列添加默认配置（纯函数）。
 *
 * 默认行为：
 * - base 默认：{ width: 200, ellipsis: true }
 * - 特殊列：operation/state/id
 * - colKey 以 At/At2 结尾时：默认 { align: "center" }
 * - customConfig 可覆盖/扩展默认 specialColumnConfig
 */
export function withDefaultColumns(columns: Array<TableColumnLike>, customConfig?: Record<string, Record<string, unknown>>): Array<Record<string, unknown>> {
    const safeColumns = Array.isArray(columns) ? columns : [];

    const specialColumnConfig: Record<string, Record<string, unknown>> = Object.assign(
        {
            operation: { width: 100, align: "center", fixed: "right" },
            state: { width: 100, align: "center" },
            id: { width: 200, align: "center" }
        },
        customConfig || {}
    );

    return safeColumns.map((col) => {
        const colObj = typeof col === "object" && col !== null ? (col as Record<string, unknown>) : {};
        const colKey = typeof colObj["colKey"] === "string" ? (colObj["colKey"] as string) : undefined;

        let specialConfig = colKey ? specialColumnConfig[colKey] : undefined;

        if (!specialConfig && typeof colKey === "string" && (colKey.endsWith("At") || colKey.endsWith("At2"))) {
            specialConfig = { align: "center" };
        }

        const base: Record<string, unknown> = {
            width: 200,
            ellipsis: true
        };

        const merged: Record<string, unknown> = Object.assign({}, base);
        if (specialConfig) {
            Object.assign(merged, specialConfig);
        }
        Object.assign(merged, colObj);

        return merged;
    });
}
