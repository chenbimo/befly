import { test, expect } from 'bun:test';
import { ruleSplit, formatDate, calcPerfTime, isType, pickFields, omitFields, isEmptyObject, isEmptyArray, filterLogFields, parseFieldRule } from '../utils/index.js';

test('ruleSplit 合并第5段之后的内容', () => {
    expect(ruleSplit('a,b,c,d,e,f,g')).toEqual(['a', 'b', 'c', 'd', 'e,f,g']);
    expect(ruleSplit('a,b,c,d')).toEqual(['a', 'b', 'c', 'd']);
});

test('formatDate 固定时间输出', () => {
    const date = new Date('2025-08-27T12:34:56Z');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2025-08-27');
});

test('calcPerfTime 小于1秒与大于1秒', () => {
    const start = 0n;
    const endMs = 500; // 0.5s
    const end = BigInt(endMs) * 1000000n;
    const s1 = calcPerfTime(Number(start), Number(end));
    expect(s1.includes('毫秒') || s1.includes('秒')).toBe(true);
});

test('isType 多类型判断', () => {
    expect(isType(null, 'null')).toBe(true);
    expect(isType(undefined, 'undefined')).toBe(true);
    expect(isType(NaN, 'nan')).toBe(true);
    expect(isType(1, 'integer')).toBe(true);
    expect(isType(1.2, 'float')).toBe(true);
    expect(isType(0, 'zero')).toBe(true);
    expect(isType({}, 'reference')).toBe(true);
    expect(isType(() => {}, 'function')).toBe(true);
});

test('pickFields/omitFields 与空判断', () => {
    const obj = { a: 1, b: 2 };
    expect(pickFields(obj, ['a'])).toEqual({ a: 1 });
    // 仅按键排除
    expect(omitFields(obj, ['a'])).toEqual({ b: 2 });
    expect(isEmptyObject({})).toBe(true);
    expect(isEmptyArray([])).toBe(true);
});

test('omitFields 对象：排除键与 undefined/null 值', () => {
    const obj = { a: 1, b: undefined, c: null, d: 0, e: '', f: false };
    // 排除键 a，且排除值 undefined
    expect(omitFields(obj, ['a'], [undefined])).toEqual({ c: null, d: 0, e: '', f: false });
    // 排除值 null
    expect(omitFields(obj, [], [null])).toEqual({ a: 1, b: undefined, d: 0, e: '', f: false });
    // 同时排除 undefined 与 null
    expect(omitFields(obj, [], [undefined, null])).toEqual({ a: 1, d: 0, e: '', f: false });
    // keys 为数组
    expect(omitFields(obj, ['a', 'd'], [undefined, null])).toEqual({ e: '', f: false });
});

test('omitFields 数组：元素为对象时清洗字段与值', () => {
    const arr = [{ a: 1, b: undefined, c: null }, { a: 2, c: 3 }, { b: null }];
    const ret = omitFields(arr, ['a'], [undefined, null]);
    expect(ret).toEqual([
        {}, // a 移除，b/c 因值在排除列表中被移除
        { c: 3 }, // a 被移除
        {} // b:null 被移除
    ]);
});

test('omitFields 数组：元素为原始值时按值过滤', () => {
    const arr = [1, 0, null, undefined, 'x'];
    expect(omitFields(arr, [], [null, undefined])).toEqual([1, 0, 'x']);
    expect(omitFields(arr, [], [0])).toEqual([1, null, undefined, 'x']);
});

test('filterLogFields 过滤敏感字段', () => {
    const body = { a: 1, password: 'x', token: 'y' };
    const filtered = filterLogFields(body, 'password, token');
    expect(filtered).toEqual({ a: 1 });
});

test('parseFieldRule 正确解析与校验 7 段规则', () => {
    const rule = '用户名⚡string⚡0⚡50⚡默认⚡1⚡^.+$';
    expect(parseFieldRule(rule)).toEqual(['用户名', 'string', '0', '50', '默认', '1', '^.+$']);
});
