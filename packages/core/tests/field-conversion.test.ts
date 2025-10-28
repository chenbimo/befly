/**
 * 字段转换功能测试
 */

import { describe, test, expect } from 'bun:test';
import { snakeCase } from 'es-toolkit/string';
import { keysToSnake, keysToCamel, arrayKeysToCamel, whereKeysToSnake } from '../util.js';

describe('对象键名转换', () => {
    describe('keysToSnake - 对象键转下划线', () => {
        test('应该正确转换对象的所有键', () => {
            const input = {
                userId: 123,
                userName: 'John',
                createdAt: 1697452800000
            };
            const expected = {
                user_id: 123,
                user_name: 'John',
                created_at: 1697452800000
            };
            expect(keysToSnake(input)).toEqual(expected);
        });

        test('应该保持值不变', () => {
            const input = {
                userId: 123,
                userName: 'John',
                isActive: true,
                data: { nested: 'value' }
            };
            const result = keysToSnake(input);
            expect(result.user_id).toBe(123);
            expect(result.user_name).toBe('John');
            expect(result.is_active).toBe(true);
            expect(result.data).toEqual({ nested: 'value' });
        });

        test('应该处理空对象', () => {
            expect(keysToSnake({})).toEqual({});
        });

        test('应该处理非对象输入', () => {
            expect(keysToSnake(null as any)).toBe(null);
            expect(keysToSnake(undefined as any)).toBe(undefined);
            expect(keysToSnake('string' as any)).toBe('string');
            expect(keysToSnake(123 as any)).toBe(123);
        });
    });

    describe('keysToCamel - 对象键转小驼峰', () => {
        test('应该正确转换对象的所有键', () => {
            const input = {
                user_id: 123,
                user_name: 'John',
                created_at: 1697452800000
            };
            const expected = {
                userId: 123,
                userName: 'John',
                createdAt: 1697452800000
            };
            expect(keysToCamel(input)).toEqual(expected);
        });

        test('应该保持值不变', () => {
            const input = {
                user_id: 123,
                user_name: 'John',
                is_active: true,
                data: { nested_value: 'value' }
            };
            const result = keysToCamel(input);
            expect(result.userId).toBe(123);
            expect(result.userName).toBe('John');
            expect(result.isActive).toBe(true);
            expect(result.data).toEqual({ nested_value: 'value' });
        });

        test('应该处理空对象', () => {
            expect(keysToCamel({})).toEqual({});
        });

        test('应该处理非对象输入', () => {
            expect(keysToCamel(null as any)).toBe(null);
            expect(keysToCamel(undefined as any)).toBe(undefined);
            expect(keysToCamel('string' as any)).toBe('string');
            expect(keysToCamel(123 as any)).toBe(123);
        });
    });

    describe('arrayKeysToCamel - 数组对象批量转小驼峰', () => {
        test('应该正确转换数组中所有对象的键', () => {
            const input = [
                { user_id: 1, user_name: 'John', created_at: 1697452800000 },
                { user_id: 2, user_name: 'Jane', created_at: 1697452900000 }
            ];
            const expected = [
                { userId: 1, userName: 'John', createdAt: 1697452800000 },
                { userId: 2, userName: 'Jane', createdAt: 1697452900000 }
            ];
            expect(arrayKeysToCamel(input)).toEqual(expected);
        });

        test('应该保持数组中的值不变', () => {
            const input = [
                { user_id: 1, is_active: true },
                { user_id: 2, is_active: false }
            ];
            const result = arrayKeysToCamel(input);
            expect(result[0].userId).toBe(1);
            expect(result[0].isActive).toBe(true);
            expect(result[1].userId).toBe(2);
            expect(result[1].isActive).toBe(false);
        });

        test('应该处理空数组', () => {
            expect(arrayKeysToCamel([])).toEqual([]);
        });

        test('应该处理非数组输入', () => {
            expect(arrayKeysToCamel(null as any)).toBe(null);
            expect(arrayKeysToCamel(undefined as any)).toBe(undefined);
            expect(arrayKeysToCamel({} as any)).toEqual({});
        });
    });
});

describe('Where 条件键名转换', () => {
    describe('whereKeysToSnake - Where 条件转下划线', () => {
        test('应该转换简单的 where 条件', () => {
            const input = {
                userId: 123,
                userName: 'John'
            };
            const expected = {
                user_id: 123,
                user_name: 'John'
            };
            expect(whereKeysToSnake(input)).toEqual(expected);
        });

        test('应该正确处理带操作符的字段', () => {
            const input = {
                userId$gt: 100,
                userName$like: '%John%',
                createdAt$gte: 1697452800000
            };
            const expected = {
                user_id$gt: 100,
                user_name$like: '%John%',
                created_at$gte: 1697452800000
            };
            expect(whereKeysToSnake(input)).toEqual(expected);
        });

        test('应该正确处理 $or 逻辑操作符', () => {
            const input = {
                $or: [{ userId: 1 }, { userName: 'John' }]
            };
            const expected = {
                $or: [{ user_id: 1 }, { user_name: 'John' }]
            };
            expect(whereKeysToSnake(input)).toEqual(expected);
        });

        test('应该正确处理 $and 逻辑操作符', () => {
            const input = {
                $and: [{ userId$gt: 100 }, { createdBy: 1 }]
            };
            const expected = {
                $and: [{ user_id$gt: 100 }, { created_by: 1 }]
            };
            expect(whereKeysToSnake(input)).toEqual(expected);
        });

        test('应该正确处理嵌套的 where 条件', () => {
            const input = {
                userId$gt: 100,
                userName: 'John',
                $or: [{ createdBy: 1 }, { updatedBy: 2 }]
            };
            const expected = {
                user_id$gt: 100,
                user_name: 'John',
                $or: [{ created_by: 1 }, { updated_by: 2 }]
            };
            expect(whereKeysToSnake(input)).toEqual(expected);
        });

        test('应该正确处理嵌套对象值', () => {
            const input = {
                userId: {
                    $gt: 100,
                    $lt: 200
                },
                userName: 'John'
            };
            const expected = {
                user_id: {
                    $gt: 100,
                    $lt: 200
                },
                user_name: 'John'
            };
            expect(whereKeysToSnake(input)).toEqual(expected);
        });

        test('应该正确处理复杂的嵌套结构', () => {
            const input = {
                userId$gt: 100,
                $or: [
                    {
                        userName: 'John',
                        createdAt$gte: 1697452800000
                    },
                    {
                        $and: [{ updatedBy: 1 }, { isActive: true }]
                    }
                ]
            };
            const expected = {
                user_id$gt: 100,
                $or: [
                    {
                        user_name: 'John',
                        created_at$gte: 1697452800000
                    },
                    {
                        $and: [{ updated_by: 1 }, { is_active: true }]
                    }
                ]
            };
            expect(whereKeysToSnake(input)).toEqual(expected);
        });

        test('应该处理空对象', () => {
            expect(whereKeysToSnake({})).toEqual({});
        });

        test('应该处理非对象输入', () => {
            expect(whereKeysToSnake(null as any)).toBe(null);
            expect(whereKeysToSnake(undefined as any)).toBe(undefined);
            expect(whereKeysToSnake('string' as any)).toBe('string');
        });

        test('应该保持操作符值不变', () => {
            const input = {
                userId$in: [1, 2, 3],
                userName$nin: ['admin', 'root']
            };
            const result = whereKeysToSnake(input);
            expect(result.user_id$in).toEqual([1, 2, 3]);
            expect(result.user_name$nin).toEqual(['admin', 'root']);
        });
    });
});

describe('双向转换一致性', () => {
    test('小驼峰 → 下划线 → 小驼峰应该保持一致', () => {
        const original = 'userId';
        const snake = snakeCase(original);
        const camel = camelCase(snake);
        expect(camel).toBe(original);
    });

    test('对象键双向转换应该保持值一致', () => {
        const original = {
            userId: 123,
            userName: 'John',
            createdAt: 1697452800000
        };
        const snake = keysToSnake(original);
        const camel = keysToCamel(snake);

        expect(camel.userId).toBe(original.userId);
        expect(camel.userName).toBe(original.userName);
        expect(camel.createdAt).toBe(original.createdAt);
    });

    test('数组对象双向转换应该保持值一致', () => {
        const original = [
            { userId: 1, userName: 'John' },
            { userId: 2, userName: 'Jane' }
        ];
        const snakeArray = original.map((item) => keysToSnake(item));
        const camelArray = arrayKeysToCamel(snakeArray);

        expect(camelArray).toEqual(original);
    });
});

describe('实际使用场景', () => {
    test('模拟数据库插入场景', () => {
        const apiData = {
            userId: 123,
            userName: 'John Doe',
            emailAddress: 'john@example.com',
            createdBy: 1,
            isActive: true
        };

        const dbData = keysToSnake(apiData);

        expect(dbData).toEqual({
            user_id: 123,
            user_name: 'John Doe',
            email_address: 'john@example.com',
            created_by: 1,
            is_active: true
        });
    });

    test('模拟数据库查询场景', () => {
        const dbResult = {
            user_id: 123,
            user_name: 'John Doe',
            email_address: 'john@example.com',
            created_at: 1697452800000,
            updated_at: 1697452900000
        };

        const apiResult = keysToCamel(dbResult);

        expect(apiResult).toEqual({
            userId: 123,
            userName: 'John Doe',
            emailAddress: 'john@example.com',
            createdAt: 1697452800000,
            updatedAt: 1697452900000
        });
    });

    test('模拟列表查询场景', () => {
        const dbList = [
            { user_id: 1, user_name: 'John', is_active: true },
            { user_id: 2, user_name: 'Jane', is_active: false }
        ];

        const apiList = arrayKeysToCamel(dbList);

        expect(apiList).toEqual([
            { userId: 1, userName: 'John', isActive: true },
            { userId: 2, userName: 'Jane', isActive: false }
        ]);
    });

    test('模拟复杂 where 条件场景', () => {
        const apiWhere = {
            userId$gt: 100,
            userName$like: '%John%',
            $or: [{ createdBy: 1, isActive: true }, { updatedBy: 2 }]
        };

        const dbWhere = whereKeysToSnake(apiWhere);

        expect(dbWhere).toEqual({
            user_id$gt: 100,
            user_name$like: '%John%',
            $or: [{ created_by: 1, is_active: true }, { updated_by: 2 }]
        });
    });
});
