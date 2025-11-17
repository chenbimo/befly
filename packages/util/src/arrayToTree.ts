// arrayToTree 工具函数实现

export interface ArrayToTreeOptions<T = any> {
    idField?: string; // 节点 id 字段名，默认 'id'
    pidField?: string; // 父节点 id 字段名，默认 'pid'
    childrenField?: string; // 子节点字段名，默认 'children'
    rootPid?: any; // 根节点的父 id，默认 0
    mapFn?: (node: T) => T; // 节点转换函数
}

export function arrayToTree<T = any>(items: T[], options: ArrayToTreeOptions<T> = {}): T[] {
    const { idField = 'id', pidField = 'pid', childrenField = 'children', rootPid = 0, mapFn } = options;
    const tree: T[] = [];
    for (const item of items) {
        const pid = (item as any)[pidField];
        // 用 Object.is 判断，兼容 null/undefined/0
        if (Object.is(pid, rootPid)) {
            let node = { ...item };
            if (mapFn) node = mapFn(node);
            const children = arrayToTree(items, {
                ...options,
                rootPid: (node as any)[idField]
            });
            if (children.length > 0) {
                (node as any)[childrenField] = children;
            }
            tree.push(node);
        }
    }
    return tree;
}
