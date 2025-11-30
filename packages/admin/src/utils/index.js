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

/**
 * 表格通用属性配置
 * 统一管理 height、row-key、active-row-type 等通用配置
 */
const defaultTableProps = {
    rowKey: 'id',
    height: '100%',
    activeRowType: 'single'
};

/**
 * 生成表格通用属性
 * @param {Object} overrides - 覆盖或扩展的属性
 * @returns {Object} 合并后的表格属性
 */
export function withTableProps(overrides = {}) {
    return {
        ...defaultTableProps,
        ...overrides
    };
}

/**
 * 树形表格默认配置
 */
const defaultTreeConfig = {
    childrenKey: 'children',
    treeNodeColumnIndex: 0,
    defaultExpandAll: true
};

/**
 * 生成树形表格通用属性
 * @param {Object} treeOverrides - 树形配置覆盖
 * @param {Object} tableOverrides - 表格属性覆盖
 * @returns {Object} 合并后的树形表格属性
 */
export function withTreeTableProps(treeOverrides = {}, tableOverrides = {}) {
    return {
        ...defaultTableProps,
        ...tableOverrides,
        tree: {
            ...defaultTreeConfig,
            ...treeOverrides
        }
    };
}

// 导出组合式函数
export { useTablePage } from './useTablePage.js';
