/**
 * 为表格列添加默认配置
 * @param {any[]} columns
 * @param {Record<string, any>=} customConfig
 * @returns {any[]}
 */
export function withDefaultColumns(columns, customConfig = {}) {
    /** @type {Record<string, any>} */
    const specialColumnConfig = Object.assign(
        {
            operation: { width: 100, align: "center", fixed: "right" },
            state: { width: 100, align: "center" },
            id: { width: 200, align: "center" }
        },
        customConfig
    );

    return columns.map((col) => {
        const colKey = col && col.colKey;

        let specialConfig = colKey ? specialColumnConfig[colKey] : undefined;

        if (!specialConfig && colKey && (colKey.endsWith("At") || colKey.endsWith("At2"))) {
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
