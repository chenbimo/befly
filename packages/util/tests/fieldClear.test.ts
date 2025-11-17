import { test, expect } from 'bun:test';
import { fieldClear } from '../src/fieldClear';
import type { FieldClearOptions } from '../types/fieldClear';

test('对象 pick/omit', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const options: FieldClearOptions = { pick: ['a', 'c'] };
    expect(fieldClear(obj, options)).toEqual({ a: 1, c: 3 });
});

test('数组 keepValues/excludeValues', () => {
    const arr = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
        { a: 5, b: 6 }
    ];
    const options: FieldClearOptions = { keepValues: [1, 5] };
    expect(fieldClear(arr, options)).toEqual([{ a: 1 }, { a: 5 }]);
});

test('空对象和空数组', () => {
    expect(fieldClear({}, {})).toEqual({});
    expect(fieldClear([], {})).toEqual([]);
});

test('原始值直接返回', () => {
    expect(fieldClear(123, {})).toBe(123);
});
