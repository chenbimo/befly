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
 * - 默认自带递归排序：按 sort 升序；sort 缺省/非法或 < 1 视为 999999；sort 相同按 path 自然序
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

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    const getSortValue = (node: T): number => {
        const raw = node ? (node as any).sort : undefined;
        if (typeof raw !== "number") {
            return 999999;
        }

        if (!Number.isFinite(raw)) {
            return 999999;
        }

        if (raw < 1) {
            return 999999;
        }

        return raw;
    };

    const compareNode = (a: T, b: T): number => {
        const aSort = getSortValue(a);
        const bSort = getSortValue(b);

        if (aSort !== bSort) {
            return aSort - bSort;
        }

        const aPath = a ? (a as any)[pathKey] : "";
        const bPath = b ? (b as any)[pathKey] : "";
        return collator.compare(typeof aPath === "string" ? aPath : "", typeof bPath === "string" ? bPath : "");
    };

    const sortTreeInPlace = (nodes: Array<T>): void => {
        if (!Array.isArray(nodes) || nodes.length <= 1) {
            return;
        }

        nodes.sort(compareNode);

        for (const node of nodes) {
            const children = node ? (node as any)[childrenKey] : undefined;
            if (Array.isArray(children) && children.length > 0) {
                sortTreeInPlace(children);
            }
        }
    };

    sortTreeInPlace(tree);

    return {
        flat: flat,
        tree: tree,
        map: map
    };
}
