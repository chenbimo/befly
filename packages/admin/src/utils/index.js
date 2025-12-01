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
 * 常用字段默认宽度映射
 * 根据 colKey 自动设置宽度，页面可覆盖
 */
const columnWidthMap = {
    'row-select': 50,
    id: 150,
    index: 60,
    state: 100,
    operation: 100,
    username: 150,
    nickname: 150,
    name: 150,
    title: 150,
    code: 150,
    roleCode: 120,
    path: 250,
    icon: 120,
    value: 200,
    description: 200,
    createdAt: 170,
    updatedAt: 170,
    deletedAt: 170,
    email: 200,
    phone: 130,
    sort: 80,
    pid: 80
};

/**
 * 特定字段的默认配置
 * 某些字段需要特殊的 ellipsis、align 等配置
 */
const columnDefaultProps = {
    'row-select': { ellipsis: false },
    id: { align: 'center' },
    index: { align: 'center' },
    state: { ellipsis: false, align: 'center' },
    operation: { ellipsis: false, align: 'center', fixed: 'right' },
    sort: { align: 'center' }
};

/**
 * 为表格列添加默认配置
 * @param {Array} columns - 列配置数组
 * @returns {Array} 添加默认配置后的列数组
 */
export function withDefaultColumns(columns) {
    return columns.map((col) => {
        const defaultWidth = columnWidthMap[col.colKey];
        const defaultProps = columnDefaultProps[col.colKey] || {};
        return {
            ...defaultColumnConfig,
            ...(defaultWidth && !col.width ? { width: defaultWidth } : {}),
            ...defaultProps,
            ...col
        };
    });
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
