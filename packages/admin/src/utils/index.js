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
