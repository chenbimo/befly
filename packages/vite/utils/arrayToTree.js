/**
 * @typedef {Object} ArrayToTreeOptions
 * @property {string=} idField
 * @property {string=} pidField
 * @property {string=} childrenField
 * @property {any=} rootPid
 * @property {string=} sortField
 * @property {(node: any) => any=} mapFn
 */

/**
 * @template T
 * @param {T[]} items
 * @param {ArrayToTreeOptions=} options
 * @returns {T[]}
 */
export function arrayToTree(items, options = {}) {
    const idField = typeof options.idField === "string" ? options.idField : "id";
    const pidField = typeof options.pidField === "string" ? options.pidField : "pid";
    const childrenField = typeof options.childrenField === "string" ? options.childrenField : "children";
    const rootPid = "rootPid" in options ? options.rootPid : 0;
    const sortField = "sortField" in options ? (typeof options.sortField === "string" && options.sortField.length > 0 ? options.sortField : null) : "sort";
    const mapFn = typeof options.mapFn === "function" ? options.mapFn : null;

    /**
     * pid -> items[]
     * @type {Map<any, T[]>}
     */
    const pidMap = new Map();

    for (const item of items) {
        // @ts-ignore
        const pid = item ? item[pidField] : undefined;
        const list = pidMap.get(pid);
        if (list) {
            list.push(item);
        } else {
            pidMap.set(pid, [item]);
        }
    }

    /**
     * @param {any} pid
     * @param {Set<any>} stack
     * @returns {T[]}
     */
    const build = (pid, stack) => {
        /** @type {T[]} */
        const tree = [];
        const list = pidMap.get(pid) || [];

        for (const item of list) {
            const node = Object.assign({}, item);
            const mappedNode = mapFn ? mapFn(node) : node;

            // 子节点 rootPid = node[id]
            // @ts-ignore
            const nextRootPid = mappedNode ? mappedNode[idField] : undefined;

            let children = [];
            if (!stack.has(nextRootPid)) {
                stack.add(nextRootPid);
                children = build(nextRootPid, stack);
                stack.delete(nextRootPid);
            }

            if (children.length > 0) {
                // @ts-ignore
                mappedNode[childrenField] = children;
            }

            tree.push(mappedNode);
        }

        if (sortField) {
            tree.sort((a, b) => {
                // @ts-ignore
                const av = a ? a[sortField] : undefined;
                // @ts-ignore
                const bv = b ? b[sortField] : undefined;

                const aMissing = av === undefined || av === null;
                const bMissing = bv === undefined || bv === null;
                if (aMissing && bMissing) return 0;
                if (aMissing) return 1;
                if (bMissing) return -1;

                if (typeof av === "number" && typeof bv === "number") {
                    return av - bv;
                }

                return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
            });
        }

        return tree;
    };

    return build(rootPid, new Set());
}
