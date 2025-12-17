/**
 * @typedef {Object} ArrayToTreeOptions
 * @property {string=} idField
 * @property {string=} pidField
 * @property {string=} childrenField
 * @property {any=} rootPid
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
    const mapFn = typeof options.mapFn === "function" ? options.mapFn : null;

    /** @type {T[]} */
    const tree = [];

    for (const item of items) {
        // @ts-ignore
        const pid = item[pidField];

        if (Object.is(pid, rootPid)) {
            const node = Object.assign({}, item);
            const mappedNode = mapFn ? mapFn(node) : node;

            // 子节点 rootPid = node[id]
            // @ts-ignore
            const nextRootPid = mappedNode[idField];
            const children = arrayToTree(items, {
                idField: idField,
                pidField: pidField,
                childrenField: childrenField,
                rootPid: nextRootPid,
                mapFn: mapFn
            });

            if (children.length > 0) {
                // @ts-ignore
                mappedNode[childrenField] = children;
            }

            tree.push(mappedNode);
        }
    }

    return tree;
}
