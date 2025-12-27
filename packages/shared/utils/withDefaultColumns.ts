/**
 * 为表格列添加默认配置（纯函数）。
 *
 * 设计目标：
 * - 不依赖浏览器/Node 特定 API
 * - 不修改入参 columns 的对象引用（会返回新数组，并对每个列对象做浅拷贝合并）
 *
 * 默认行为：
 * - base 默认：{ width: 200, ellipsis: true }
 * - 特殊列：operation/state/id
 * - colKey 以 At/At2 结尾时：默认 { align: "center" }
 * - customConfig 可覆盖/扩展默认 specialColumnConfig（浅合并/替换：若传入 operation 配置，将整体替换默认 operation 配置，默认 fixed="right" 不会被保留）
 */
export function withDefaultColumns(columns: any[], customConfig?: Record<string, any>): any[] {
    const safeColumns = Array.isArray(columns) ? columns : [];

    const specialColumnConfig: Record<string, any> = Object.assign(
        {
            operation: { width: 100, align: "center", fixed: "right" },
            state: { width: 100, align: "center" },
            id: { width: 200, align: "center" }
        },
        customConfig || {}
    );

    return safeColumns.map((col) => {
        const colKey = col && (col as any).colKey;

        let specialConfig = colKey ? specialColumnConfig[colKey] : undefined;

        if (!specialConfig && typeof colKey === "string" && (colKey.endsWith("At") || colKey.endsWith("At2"))) {
            specialConfig = { align: "center" };
        }

        const base = {
            width: 200,
            ellipsis: true
        };

        const merged = Object.assign({}, base);
        if (specialConfig) {
            Object.assign(merged, specialConfig);
        }
        Object.assign(merged, col);

        return merged;
    });
}
