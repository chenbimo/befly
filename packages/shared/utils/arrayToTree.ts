export type ArrayToTreeResult<T extends Record<string, unknown>> = {
    flat: Array<T>;
    tree: Array<T>;
    map: Map<string, T>;
};

/**
 * 将一维数组按 { id, pid } 组装为树形结构（纯函数 / 无副作用）。
 *
 * - 默认字段：id / pid / children / sort
 * - pid 为空字符串或父节点不存在时，视为根节点
 * - 内部会 clone 一份节点对象，并写入 children: []
 * - 默认自带递归排序：按 sort 升序；sort 缺省/非法或 < 1 视为 999999；sort 相同按 id 自然序
 */
export function arrayToTree<T extends Record<string, unknown>>(items: Array<T>, id: string = "id", pid: string = "pid", children: string = "children", sort: string = "sort"): ArrayToTreeResult<T> {
    const idKey = typeof id === "string" && id.length > 0 ? id : "id";
    const pidKey = typeof pid === "string" && pid.length > 0 ? pid : "pid";
    const childrenKey = typeof children === "string" && children.length > 0 ? children : "children";
    const sortKey = typeof sort === "string" && sort.length > 0 ? sort : "sort";

    const map = new Map<string, T>();
    const flat: T[] = [];

    const safeItems = Array.isArray(items) ? items : [];

    const normalizeKey = (value: unknown): string => {
        if (typeof value === "string") {
            return value;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
        return "";
    };

    for (const item of safeItems) {
        const itemObj = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
        const rawId = itemObj ? itemObj[idKey] : undefined;
        const rawPid = itemObj ? itemObj[pidKey] : undefined;

        const normalizedId = normalizeKey(rawId);
        const normalizedPid = normalizeKey(rawPid);

        const nextNode = Object.assign({}, item) as T;
        const nextNodeObj = nextNode as Record<string, unknown>;
        nextNodeObj[idKey] = normalizedId;
        nextNodeObj[pidKey] = normalizedPid;
        nextNodeObj[childrenKey] = [];

        flat.push(nextNode);

        if (normalizedId.length > 0) {
            map.set(normalizedId, nextNode);
        }
    }

    const tree: T[] = [];

    for (const node of flat) {
        const nodeObj = node as Record<string, unknown>;
        const selfId = normalizeKey(nodeObj[idKey]);
        const parentId = normalizeKey(nodeObj[pidKey]);

        if (parentId.length > 0 && parentId !== selfId) {
            const parent = map.get(parentId);
            if (parent) {
                const parentObj = parent as Record<string, unknown>;
                const childrenValue = parentObj[childrenKey];
                if (Array.isArray(childrenValue)) {
                    childrenValue.push(node);
                    continue;
                }
            }
        }

        tree.push(node);
    }

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    const getSortValue = (node: T): number => {
        const nodeObj = node as Record<string, unknown>;
        const raw = nodeObj[sortKey];
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

        const aObj = a as Record<string, unknown>;
        const bObj = b as Record<string, unknown>;
        const aId = aObj[idKey];
        const bId = bObj[idKey];

        return collator.compare(typeof aId === "string" ? aId : "", typeof bId === "string" ? bId : "");
    };

    const sortTreeInPlace = (nodes: Array<T>, seen: WeakSet<object>): void => {
        if (!Array.isArray(nodes)) {
            return;
        }

        if (nodes.length > 1) {
            nodes.sort(compareNode);
        }

        for (const node of nodes) {
            if (typeof node !== "object" || node === null) {
                continue;
            }

            if (seen.has(node)) {
                continue;
            }
            seen.add(node);

            const nodeObj = node as Record<string, unknown>;
            const childNodes = nodeObj[childrenKey];
            if (Array.isArray(childNodes) && childNodes.length > 0) {
                sortTreeInPlace(childNodes as Array<T>, seen);
            }
        }
    };

    sortTreeInPlace(tree, new WeakSet<object>());

    return {
        flat: flat,
        tree: tree,
        map: map
    };
}
