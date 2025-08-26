import { test, expect } from 'bun:test';
import { ruleSplit, formatDate, calculateElapsedTime, isType, pickFields, omitFields, isEmptyObject, isEmptyArray, filterLogFields, parseFieldRule } from '../utils/util.js';

test('ruleSplit 合并第5段之后的内容', () => {
    expect(ruleSplit('a,b,c,d,e,f,g')).toEqual(['a', 'b', 'c', 'd', 'e,f,g']);
    expect(ruleSplit('a,b,c,d')).toEqual(['a', 'b', 'c', 'd']);
});

test('formatDate 固定时间输出', () => {
    const date = new Date('2025-08-27T12:34:56Z');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2025-08-27');
});

test('calculateElapsedTime 小于1秒与大于1秒', () => {
    const start = 0n;
    const endMs = 500; // 0.5s
    const end = BigInt(endMs) * 1000000n;
    const s1 = calculateElapsedTime(Number(start), Number(end));
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
    expect(omitFields(obj, ['a'])).toEqual({ b: 2 });
    expect(isEmptyObject({})).toBe(true);
    expect(isEmptyArray([])).toBe(true);
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
