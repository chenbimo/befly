/**
 * 将一维数组转换为树形结构
 * @template T
 * @param {T[]} items - 一维数组
 * @param {number} [pid=0] - 父节点ID，默认为0
 * @returns {T[]} 树形结构数组
 */
export function arrayToTree(items, pid = 0) {
    const tree = [];

    for (const item of items) {
        if (item.pid === pid) {
            const children = arrayToTree(items, item.id);
            const node = { ...item };

            if (children.length > 0) {
                node.children = children;
            }

            tree.push(node);
        }
    }

    return tree;
}

/**
 * 表格列默认配置
 * 统一设置超出显示省略号等通用配置
 */
const defaultColumnConfig = {
    ellipsis: true,
    ellipsisTitle: true
};

/**
 * 为表格列添加默认配置
 * @param {Array} columns - 列配置数组
 * @returns {Array} 添加默认配置后的列数组
 */
export function withDefaultColumns(columns) {
    return columns.map((col) => ({
        ...defaultColumnConfig,
        ...col
    }));
}

// 导出组合式函数
export { useTablePage } from './useTablePage.js';
