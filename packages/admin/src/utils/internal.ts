/**
 * 框架核心工具函数
 * ⚠️ 此文件由 befly-admin 包管理，请勿修改
 * 运行 `befly sync:admin` 会自动更新此文件
 */

/**
 * 将一维数组转换为树形结构
 * @param items 一维数组
 * @param pid 父节点ID，默认为0
 * @returns 树形结构数组
 */
export function arrayToTree<T extends { id: number; pid: number; children?: T[] }>(items: T[], pid = 0): T[] {
    const tree: T[] = [];

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
