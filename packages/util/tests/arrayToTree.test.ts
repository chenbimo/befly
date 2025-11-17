import { arrayToTree } from '../src/arrayToTree';
import type { ArrayToTreeOptions } from '../types/arrayToTree';

// 默认场景测试
const flat = [
    { id: 1, pid: 0, name: 'A' },
    { id: 2, pid: 1, name: 'B' },
    { id: 3, pid: 1, name: 'C' },
    { id: 4, pid: 2, name: 'D' }
];
console.log('默认树:', JSON.stringify(arrayToTree(flat)));

// 自定义字段测试
const custom = [
    { key: 'a', parent: null, label: 'A' },
    { key: 'b', parent: 'a', label: 'B' },
    { key: 'c', parent: 'a', label: 'C' },
    { key: 'd', parent: 'b', label: 'D' }
];
const customOptions: ArrayToTreeOptions<(typeof custom)[0]> = {
    idField: 'key',
    pidField: 'parent',
    childrenField: 'nodes',
    rootPid: null
};
console.log('自定义字段树:', JSON.stringify(arrayToTree(custom, customOptions)));

// mapFn 测试
const mapOptions: ArrayToTreeOptions<(typeof custom)[0]> = {
    ...customOptions,
    mapFn: (node) => ({ ...node, extra: true })
};
console.log('mapFn 树:', JSON.stringify(arrayToTree(custom, mapOptions)));

// 空数组测试
console.log('空数组:', arrayToTree([], {}));

// 单节点测试
console.log('单节点:', arrayToTree([{ id: 1, pid: 0 }], {}));
