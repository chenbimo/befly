export type BuildTreeByParentPathOptions = {
    pathKey?: string;
    parentPathKey?: string;
    childrenKey?: string;
    normalize?: (value: unknown) => string;
};

export type BuildTreeByParentPathResult<T extends Record<string, any>> = {
    flat: Array<T>;
    tree: Array<T>;
    map: Map<string, T>;
};

/**
 * 将一维数组按 { path, parentPath } 组装为树形结构（纯函数 / 无副作用）。
 *
 * - 默认字段：path / parentPath / children
 * - parentPath 为空字符串或父节点不存在时，视为根节点
 * - 内部会 clone 一份节点对象，并写入 children: []
 */
export function buildTreeByParentPath<T extends Record<string, any>>(items: T[], options?: BuildTreeByParentPathOptions): BuildTreeByParentPathResult<T> {
    const pathKey = typeof options?.pathKey === "string" && options.pathKey.length > 0 ? options.pathKey : "path";
    const parentPathKey = typeof options?.parentPathKey === "string" && options.parentPathKey.length > 0 ? options.parentPathKey : "parentPath";
    const childrenKey = typeof options?.childrenKey === "string" && options.childrenKey.length > 0 ? options.childrenKey : "children";

    const normalize =
        typeof options?.normalize === "function"
            ? options.normalize
            : (value: unknown) => {
                  return typeof value === "string" ? value : "";
              };

    const map = new Map<string, T>();
    const flat: T[] = [];

    const safeItems = Array.isArray(items) ? items : [];

    for (const item of safeItems) {
        const rawPath = item ? item[pathKey] : undefined;
        const rawParentPath = item ? item[parentPathKey] : undefined;

        const normalizedPath = normalize(rawPath);
        const normalizedParentPath = normalize(rawParentPath);

        const nextNode = Object.assign({}, item) as T;
        (nextNode as any)[pathKey] = normalizedPath;
        (nextNode as any)[parentPathKey] = normalizedParentPath;
        (nextNode as any)[childrenKey] = [];

        flat.push(nextNode);

        if (typeof normalizedPath === "string" && normalizedPath.length > 0) {
            map.set(normalizedPath, nextNode);
        }
    }

    const tree: T[] = [];
    for (const node of flat) {
        const parentPath = (node as any)[parentPathKey];

        if (typeof parentPath === "string" && parentPath.length > 0) {
            const parent = map.get(parentPath);
            if (parent && Array.isArray((parent as any)[childrenKey])) {
                (parent as any)[childrenKey].push(node);
                continue;
            }
        }

        tree.push(node);
    }

    return {
        flat: flat,
        tree: tree,
        map: map
    };
}
