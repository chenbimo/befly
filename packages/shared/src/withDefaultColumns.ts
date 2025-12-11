/**
 * 为表格列添加默认配置
 * @param columns - 列配置数组
 * @param customConfig - 自定义特殊列配置，可覆盖默认的 specialColumnConfig
 * @returns 添加默认配置后的列数组
 */
export function withDefaultColumns(columns: any[], customConfig: Record<string, any> = {}): any[] {
    /**
     * 特殊列配置映射
     */
    const specialColumnConfig: Record<string, any> = {
        operation: { width: 100, align: 'center', fixed: 'right' },
        state: { width: 100, align: 'center' },
        id: { width: 200, align: 'center' },
        ...customConfig
    };

    return columns.map((col) => {
        const colKey = col.colKey;

        // 特殊列配置
        let specialConfig = specialColumnConfig[colKey];

        // 以 At 或 At2 结尾的列（时间字段）
        if (!specialConfig && colKey && (colKey.endsWith('At') || colKey.endsWith('At2'))) {
            specialConfig = { align: 'center' };
        }

        return {
            width: 200,
            ellipsis: true,
            ...specialConfig,
            ...col
        };
    });
}
