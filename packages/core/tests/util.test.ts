import { describe, test, expect } from 'bun:test';
import { keysToCamel, keysToSnake, arrayKeysToCamel, calcPerfTime, fieldClear } from 'befly-util';

describe('Util - keysToCamel', () => {
    test('转换对象键名为驼峰', () => {
        const result = keysToCamel({ user_name: 'John', user_id: 123 });
        expect(result.userName).toBe('John');
        expect(result.userId).toBe(123);
    });

    test('保持已有驼峰格式', () => {
        const result = keysToCamel({ userName: 'John', userId: 123 });
        expect(result.userName).toBe('John');
        expect(result.userId).toBe(123);
    });

    test('处理空对象', () => {
        const result = keysToCamel({});
        expect(Object.keys(result).length).toBe(0);
    });

    test('处理嵌套对象', () => {
        const result = keysToCamel({ user_info: { first_name: 'John' } });
        expect(result.userInfo).toBeDefined();
    });
});

describe('Util - keysToSnake', () => {
    test('转换对象键名为下划线', () => {
        const result = keysToSnake({ userName: 'John', userId: 123 });
        expect(result.user_name).toBe('John');
        expect(result.user_id).toBe(123);
    });

    test('保持已有下划线格式', () => {
        const result = keysToSnake({ user_name: 'John', user_id: 123 });
        expect(result.user_name).toBe('John');
        expect(result.user_id).toBe(123);
    });

    test('处理空对象', () => {
        const result = keysToSnake({});
        expect(Object.keys(result).length).toBe(0);
    });
});

describe('Util - arrayKeysToCamel', () => {
    test('转换数组中对象键名为驼峰', () => {
        const result = arrayKeysToCamel([
            { user_name: 'John', user_id: 1 },
            { user_name: 'Jane', user_id: 2 }
        ]);
        expect(result[0].userName).toBe('John');
        expect(result[0].userId).toBe(1);
        expect(result[1].userName).toBe('Jane');
        expect(result[1].userId).toBe(2);
    });

    test('处理空数组', () => {
        const result = arrayKeysToCamel([]);
        expect(result.length).toBe(0);
    });
});

describe('Util - fieldClear', () => {
    test('移除 null 和 undefined', () => {
        const result = fieldClear({ a: 1, b: null, c: undefined, d: 'test' }, { excludeValues: [null, undefined] });
        expect(result.a).toBe(1);
        expect(result.b).toBeUndefined();
        expect(result.c).toBeUndefined();
        expect(result.d).toBe('test');
    });

    test('保留指定值', () => {
        const result = fieldClear({ a: 1, b: null, c: 0 }, { excludeValues: [null, undefined], keepMap: { c: 0 } });
        expect(result.a).toBe(1);
        expect(result.b).toBeUndefined();
        expect(result.c).toBe(0);
    });

    test('处理空对象', () => {
        const result = fieldClear({});
        expect(Object.keys(result).length).toBe(0);
    });
});

describe('Util - calcPerfTime', () => {
    test('计算性能时间', () => {
        const start = Bun.nanoseconds();
        const result = calcPerfTime(start);
        expect(result).toContain('毫秒');
        expect(typeof result).toBe('string');
        expect(result).toMatch(/\d+(\.\d+)?\s*毫秒/);
    });
});
