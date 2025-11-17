import { test, expect } from 'bun:test';
import { arrayToTree } from '../src/arrayToTree';
import type { ArrayToTreeOptions } from '../types/arrayToTree';

test('默认字段树结构', () => {
    const flat = [
        { id: 1, pid: 0, name: 'A' },
        { id: 2, pid: 1, name: 'B' },
        { id: 3, pid: 1, name: 'C' },
        { id: 4, pid: 2, name: 'D' }
    ];
    expect(arrayToTree(flat)).toEqual([
        {
            id: 1,
            pid: 0,
            name: 'A',
            children: [
                {
                    id: 2,
                    pid: 1,
                    name: 'B',
                    children: [{ id: 4, pid: 2, name: 'D' }]
                },
                { id: 3, pid: 1, name: 'C' }
            ]
        }
    ]);
});

test('自定义字段树结构', () => {
    const custom = [
        { key: 'a', parent: null, label: 'A' },
        { key: 'b', parent: 'a', label: 'B' },
        { key: 'c', parent: 'a', label: 'C' },
        { key: 'd', parent: 'b', label: 'D' }
    ];
    const options: ArrayToTreeOptions<(typeof custom)[0]> = {
        idField: 'key',
        pidField: 'parent',
        childrenField: 'nodes',
        rootPid: null
    };
    expect(arrayToTree(custom, options)).toEqual([
        {
            key: 'a',
            parent: null,
            label: 'A',
            nodes: [
                {
                    key: 'b',
                    parent: 'a',
                    label: 'B',
                    nodes: [{ key: 'd', parent: 'b', label: 'D' }]
                },
                { key: 'c', parent: 'a', label: 'C' }
            ]
        }
    ]);
});

test('mapFn 节点转换', () => {
    const custom = [
        { key: 'a', parent: null, label: 'A' },
        { key: 'b', parent: 'a', label: 'B' },
        { key: 'c', parent: 'a', label: 'C' },
        { key: 'd', parent: 'b', label: 'D' }
    ];
    const options: ArrayToTreeOptions<(typeof custom)[0]> = {
        idField: 'key',
        pidField: 'parent',
        childrenField: 'nodes',
        rootPid: null,
        mapFn: (node) => ({ ...node, extra: true })
    };
    expect(arrayToTree(custom, options)).toEqual([
        {
            key: 'a',
            parent: null,
            label: 'A',
            extra: true,
            nodes: [
                {
                    key: 'b',
                    parent: 'a',
                    label: 'B',
                    extra: true,
                    nodes: [{ key: 'd', parent: 'b', label: 'D', extra: true }]
                },
                { key: 'c', parent: 'a', label: 'C', extra: true }
            ]
        }
    ]);
});

test('空数组和单节点', () => {
    expect(arrayToTree([], {})).toEqual([]);
    expect(arrayToTree([{ id: 1, pid: 0 }], {})).toEqual([{ id: 1, pid: 0 }]);
});
