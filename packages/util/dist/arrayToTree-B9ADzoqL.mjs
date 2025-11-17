//#region src/arrayToTree.ts
function arrayToTree(items, options = {}) {
	const { idField = "id", pidField = "pid", childrenField = "children", rootPid = 0, mapFn } = options;
	const tree = [];
	for (const item of items) {
		const pid = item[pidField];
		if (Object.is(pid, rootPid)) {
			let node = { ...item };
			if (mapFn) node = mapFn(node);
			const children = arrayToTree(items, {
				...options,
				rootPid: node[idField]
			});
			if (children.length > 0) node[childrenField] = children;
			tree.push(node);
		}
	}
	return tree;
}

//#endregion
export { arrayToTree as t };