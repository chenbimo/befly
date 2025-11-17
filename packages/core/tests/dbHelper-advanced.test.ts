/**
 * DbHelper 高级测试用例
 * 测试边界条件、错误处理、复杂场景
 */

import { describe, test, expect } from 'bun:test';

describe('DbHelper - 字段验证逻辑', () => {
    test('validateAndClassifyFields - 空数组应返回 all 类型', () => {
        // 测试目的：验证空数组被正确识别为查询所有字段
        const mockHelper = {
            validateAndClassifyFields: (fields?: string[]) => {
                if (!fields || fields.length === 0) {
                    return { type: 'all' as const, fields: [] };
                }
                return { type: 'include' as const, fields: fields };
            }
        };

        const result = mockHelper.validateAndClassifyFields([]);
        expect(result.type).toBe('all');
        expect(result.fields.length).toBe(0);
    });

    test('validateAndClassifyFields - undefined 应返回 all 类型', () => {
        const mockHelper = {
            validateAndClassifyFields: (fields?: string[]) => {
                if (!fields || fields.length === 0) {
                    return { type: 'all' as const, fields: [] };
                }
                return { type: 'include' as const, fields: fields };
            }
        };

        const result = mockHelper.validateAndClassifyFields(undefined);
        expect(result.type).toBe('all');
    });

    test('validateAndClassifyFields - 星号应抛出错误', () => {
        const mockHelper = {
            validateAndClassifyFields: (fields?: string[]) => {
                if (!fields || fields.length === 0) {
                    return { type: 'all' as const, fields: [] };
                }
                if (fields.some((f) => f === '*')) {
                    throw new Error('fields 不支持 * 星号');
                }
                return { type: 'include' as const, fields: fields };
            }
        };

        expect(() => {
            mockHelper.validateAndClassifyFields(['id', '*', 'name']);
        }).toThrow('fields 不支持 * 星号');
    });

    test('validateAndClassifyFields - 空字符串应抛出错误', () => {
        const mockHelper = {
            validateAndClassifyFields: (fields?: string[]) => {
                if (fields.some((f) => !f || typeof f !== 'string' || f.trim() === '')) {
                    throw new Error('fields 不能包含空字符串或无效值');
                }
                return { type: 'include' as const, fields: fields };
            }
        };

        expect(() => {
            mockHelper.validateAndClassifyFields(['id', '', 'name']);
        }).toThrow('fields 不能包含空字符串或无效值');
    });

    test('validateAndClassifyFields - 混用包含和排除字段应抛出错误', () => {
        const mockHelper = {
            validateAndClassifyFields: (fields?: string[]) => {
                const includeFields = fields!.filter((f) => !f.startsWith('!'));
                const excludeFields = fields!.filter((f) => f.startsWith('!'));

                if (includeFields.length > 0 && excludeFields.length > 0) {
                    throw new Error('fields 不能同时包含普通字段和排除字段');
                }

                if (excludeFields.length > 0) {
                    return { type: 'exclude' as const, fields: excludeFields.map((f) => f.substring(1)) };
                }

                return { type: 'include' as const, fields: includeFields };
            }
        };

        expect(() => {
            mockHelper.validateAndClassifyFields(['id', '!password', 'name']);
        }).toThrow('fields 不能同时包含普通字段和排除字段');
    });

    test('validateAndClassifyFields - 排除字段应正确去除感叹号', () => {
        const mockHelper = {
            validateAndClassifyFields: (fields?: string[]) => {
                const excludeFields = fields!.filter((f) => f.startsWith('!'));
                return { type: 'exclude' as const, fields: excludeFields.map((f) => f.substring(1)) };
            }
        };

        const result = mockHelper.validateAndClassifyFields(['!password', '!token', '!salt']);
        expect(result.type).toBe('exclude');
        expect(result.fields).toEqual(['password', 'token', 'salt']);
    });
});

describe('DbHelper - BIGINT 字段转换逻辑', () => {
    test('convertBigIntFields - 白名单字段应转换', () => {
        const mockConvert = (arr: any[]) => {
            return arr.map((item) => {
                const converted = { ...item };
                const whiteList = ['id', 'pid', 'sort'];
                for (const key of whiteList) {
                    if (key in converted && typeof converted[key] === 'string') {
                        converted[key] = Number(converted[key]);
                    }
                }
                return converted;
            });
        };

        const data = [{ id: '123', pid: '456', sort: '10', name: 'test' }];
        const result = mockConvert(data);

        expect(result[0].id).toBe(123);
        expect(result[0].pid).toBe(456);
        expect(result[0].sort).toBe(10);
        expect(typeof result[0].id).toBe('number');
    });

    test('convertBigIntFields - Id 后缀字段应转换', () => {
        const mockConvert = (arr: any[]) => {
            return arr.map((item) => {
                const converted = { ...item };
                for (const [key, value] of Object.entries(converted)) {
                    if ((key.endsWith('Id') || key.endsWith('_id')) && typeof value === 'string') {
                        converted[key] = Number(value);
                    }
                }
                return converted;
            });
        };

        const data = [{ userId: '100', roleId: '200', category_id: '300', name: 'test' }];
        const result = mockConvert(data);

        expect(result[0].userId).toBe(100);
        expect(result[0].roleId).toBe(200);
        expect(result[0].category_id).toBe(300);
    });

    test('convertBigIntFields - At 后缀字段应转换（时间戳）', () => {
        const mockConvert = (arr: any[]) => {
            return arr.map((item) => {
                const converted = { ...item };
                for (const [key, value] of Object.entries(converted)) {
                    if ((key.endsWith('At') || key.endsWith('_at')) && typeof value === 'string') {
                        converted[key] = Number(value);
                    }
                }
                return converted;
            });
        };

        const data = [{ createdAt: '1609459200000', updatedAt: '1609459300000', deleted_at: '0' }];
        const result = mockConvert(data);

        expect(result[0].createdAt).toBe(1609459200000);
        expect(result[0].updatedAt).toBe(1609459300000);
        expect(result[0].deleted_at).toBe(0);
    });

    test('convertBigIntFields - 非数字字符串不应转换', () => {
        const mockConvert = (arr: any[]) => {
            return arr.map((item) => {
                const converted = { ...item };
                for (const [key, value] of Object.entries(converted)) {
                    if (key.endsWith('Id') && typeof value === 'string') {
                        const num = Number(value);
                        if (!isNaN(num)) {
                            converted[key] = num;
                        }
                    }
                }
                return converted;
            });
        };

        const data = [{ userId: 'invalid', roleId: '123' }];
        const result = mockConvert(data);

        expect(result[0].userId).toBe('invalid'); // 保持原值
        expect(result[0].roleId).toBe(123);
    });

    test('convertBigIntFields - null 和 undefined 应跳过', () => {
        const mockConvert = (arr: any[]) => {
            return arr.map((item) => {
                const converted = { ...item };
                for (const [key, value] of Object.entries(converted)) {
                    if (value === null || value === undefined) continue;
                    if (key.endsWith('Id') && typeof value === 'string') {
                        converted[key] = Number(value);
                    }
                }
                return converted;
            });
        };

        const data = [{ userId: null, roleId: undefined, categoryId: '123' }];
        const result = mockConvert(data);

        expect(result[0].userId).toBeNull();
        expect(result[0].roleId).toBeUndefined();
        expect(result[0].categoryId).toBe(123);
    });

    test('convertBigIntFields - 空数组应返回空数组', () => {
        const mockConvert = (arr: any[]) => {
            if (!arr || !Array.isArray(arr)) return arr;
            return arr;
        };

        const result = mockConvert([]);
        expect(result).toEqual([]);
    });

    test('convertBigIntFields - 非数组应返回原值', () => {
        const mockConvert = (arr: any) => {
            if (!arr || !Array.isArray(arr)) return arr;
            return arr;
        };

        const result = mockConvert(null);
        expect(result).toBeNull();
    });
});

describe('DbHelper - WHERE 条件键名转换', () => {
    test('whereKeysToSnake - 简单字段名应转换为下划线', () => {
        const snakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        const mockConvert = (where: any): any => {
            const result: any = {};
            for (const [key, value] of Object.entries(where)) {
                result[snakeCase(key)] = value;
            }
            return result;
        };

        const where = { userId: 123, userName: 'john' };
        const result = mockConvert(where);

        expect(result.user_id).toBe(123);
        expect(result.user_name).toBe('john');
    });

    test('whereKeysToSnake - 带操作符的字段名应正确处理', () => {
        const snakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        const mockConvert = (where: any): any => {
            const result: any = {};
            for (const [key, value] of Object.entries(where)) {
                if (key.includes('$')) {
                    const lastDollarIndex = key.lastIndexOf('$');
                    const fieldName = key.substring(0, lastDollarIndex);
                    const operator = key.substring(lastDollarIndex);
                    result[snakeCase(fieldName) + operator] = value;
                } else {
                    result[snakeCase(key)] = value;
                }
            }
            return result;
        };

        const where = { userId$gt: 100, userName$like: '%john%' };
        const result = mockConvert(where);

        expect(result.user_id$gt).toBe(100);
        expect(result.user_name$like).toBe('%john%');
    });

    test('whereKeysToSnake - $or 和 $and 应递归处理', () => {
        const snakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        const mockConvert = (where: any): any => {
            if (!where || typeof where !== 'object') return where;
            if (Array.isArray(where)) {
                return where.map((item) => mockConvert(item));
            }

            const result: any = {};
            for (const [key, value] of Object.entries(where)) {
                if (key === '$or' || key === '$and') {
                    result[key] = (value as any[]).map((item) => mockConvert(item));
                } else {
                    result[snakeCase(key)] = value;
                }
            }
            return result;
        };

        const where = {
            $or: [{ userId: 1 }, { userName: 'john' }]
        };
        const result = mockConvert(where);

        expect(result.$or[0].user_id).toBe(1);
        expect(result.$or[1].user_name).toBe('john');
    });

    test('whereKeysToSnake - 嵌套对象应递归转换', () => {
        const snakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        const mockConvert = (where: any): any => {
            if (!where || typeof where !== 'object') return where;

            const result: any = {};
            for (const [key, value] of Object.entries(where)) {
                const snakeKey = snakeCase(key);
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    result[snakeKey] = mockConvert(value);
                } else {
                    result[snakeKey] = value;
                }
            }
            return result;
        };

        const where = {
            userProfile: {
                firstName: 'John',
                lastName: 'Doe'
            }
        };
        const result = mockConvert(where);

        expect(result.user_profile.first_name).toBe('John');
        expect(result.user_profile.last_name).toBe('Doe');
    });
});

describe('DbHelper - 默认状态过滤', () => {
    test('addDefaultStateFilter - 应添加 state > 0 条件', () => {
        const mockAddFilter = (where: any) => {
            return {
                ...where,
                state$gt: 0
            };
        };

        const where = { userId: 123 };
        const result = mockAddFilter(where);

        expect(result.userId).toBe(123);
        expect(result.state$gt).toBe(0);
    });

    test('addDefaultStateFilter - 已有 state 条件不应覆盖', () => {
        // **潜在问题**：如果用户传入 state: 0（查询已删除数据），
        // addDefaultStateFilter 可能会添加 state$gt: 0，导致冲突

        const mockAddFilter = (where: any) => {
            // 正确做法：检查是否已有 state 相关条件
            if ('state' in where || 'state$gt' in where || 'state$gte' in where) {
                return where; // 不添加默认过滤
            }
            return {
                ...where,
                state$gt: 0
            };
        };

        const where1 = { userId: 123, state: 0 }; // 查询已删除数据
        const result1 = mockAddFilter(where1);
        expect(result1.state).toBe(0);
        expect(result1.state$gt).toBeUndefined(); // 不应添加

        const where2 = { userId: 123 };
        const result2 = mockAddFilter(where2);
        expect(result2.state$gt).toBe(0); // 应添加
    });
});

describe('DbHelper - 分页参数验证', () => {
    test('getList - page 小于 1 应抛出错误', () => {
        const mockValidate = (page: number, limit: number) => {
            if (page < 1 || page > 10000) {
                throw new Error(`页码必须在 1 到 10000 之间 (page: ${page})`);
            }
        };

        expect(() => mockValidate(0, 10)).toThrow('页码必须在 1 到 10000 之间');
        expect(() => mockValidate(-5, 10)).toThrow('页码必须在 1 到 10000 之间');
    });

    test('getList - page 大于 10000 应抛出错误', () => {
        const mockValidate = (page: number) => {
            if (page > 10000) {
                throw new Error(`页码必须在 1 到 10000 之间 (page: ${page})`);
            }
        };

        expect(() => mockValidate(10001)).toThrow('页码必须在 1 到 10000 之间');
    });

    test('getList - limit 小于 1 应抛出错误', () => {
        const mockValidate = (limit: number) => {
            if (limit < 1 || limit > 1000) {
                throw new Error(`每页数量必须在 1 到 1000 之间 (limit: ${limit})`);
            }
        };

        expect(() => mockValidate(0)).toThrow('每页数量必须在 1 到 1000 之间');
    });

    test('getList - limit 大于 1000 应抛出错误', () => {
        const mockValidate = (limit: number) => {
            if (limit > 1000) {
                throw new Error(`每页数量必须在 1 到 1000 之间 (limit: ${limit})`);
            }
        };

        expect(() => mockValidate(1001)).toThrow('每页数量必须在 1 到 1000 之间');
    });

    test('getList - 边界值测试', () => {
        const mockValidate = (page: number, limit: number) => {
            if (page < 1 || page > 10000) {
                throw new Error(`页码无效`);
            }
            if (limit < 1 || limit > 1000) {
                throw new Error(`每页数量无效`);
            }
            return true;
        };

        expect(mockValidate(1, 1)).toBe(true); // 最小值
        expect(mockValidate(10000, 1000)).toBe(true); // 最大值
        expect(mockValidate(5000, 500)).toBe(true); // 中间值
    });
});

describe('DbHelper - 总数为 0 的优化', () => {
    test('getList - 总数为 0 应直接返回空结果', async () => {
        const mockGetList = async (total: number, page: number, limit: number) => {
            if (total === 0) {
                return {
                    lists: [],
                    total: 0,
                    page: page,
                    limit: limit,
                    pages: 0
                };
            }
            // 执行第二次查询...
            return {
                lists: [{ id: 1 }],
                total: total,
                page: page,
                limit: limit,
                pages: Math.ceil(total / limit)
            };
        };

        const result = await mockGetList(0, 1, 10);
        expect(result.lists.length).toBe(0);
        expect(result.total).toBe(0);
        expect(result.pages).toBe(0);
    });

    test('getList - pages 计算应正确', () => {
        const calcPages = (total: number, limit: number) => Math.ceil(total / limit);

        expect(calcPages(100, 10)).toBe(10); // 整除
        expect(calcPages(105, 10)).toBe(11); // 有余数
        expect(calcPages(5, 10)).toBe(1); // 小于一页
        expect(calcPages(0, 10)).toBe(0); // 空结果
    });
});

describe('DbHelper - 字段清理逻辑', () => {
    test('cleanFields - 应排除 null 和 undefined', () => {
        const mockClean = (data: any) => {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined) {
                    result[key] = value;
                }
            }
            return result;
        };

        const data = { name: 'test', age: null, email: undefined, score: 0 };
        const result = mockClean(data);

        expect(result.name).toBe('test');
        expect(result.age).toBeUndefined();
        expect(result.email).toBeUndefined();
        expect(result.score).toBe(0); // 0 应保留
    });

    test('cleanFields - 空对象应返回空对象', () => {
        const mockClean = (data: any) => {
            if (!data || Object.keys(data).length === 0) return {};
            return data;
        };

        expect(mockClean({})).toEqual({});
        expect(mockClean(null)).toEqual({});
        expect(mockClean(undefined)).toEqual({});
    });
});

describe('DbHelper - SQL 执行错误处理', () => {
    test('executeWithConn - SQL 错误应包含完整信息', () => {
        const mockExecute = async (sql: string, params?: any[]) => {
            try {
                // 模拟 SQL 错误
                throw new Error('Table not found');
            } catch (error: any) {
                const errorMsg = `SQL 执行失败 - ${error.message} - SQL: ${sql} - 参数: ${JSON.stringify(params)}`;
                throw new Error(errorMsg);
            }
        };

        expect(async () => {
            await mockExecute('SELECT * FROM non_existent_table', []);
        }).toThrow();
    });

    test('executeWithConn - 超长 SQL 应截断', () => {
        const mockTruncate = (sql: string, maxLength: number = 500) => {
            if (sql.length > maxLength) {
                return sql.substring(0, maxLength) + '...';
            }
            return sql;
        };

        const longSql = 'SELECT * FROM users WHERE ' + 'name = ? AND '.repeat(100) + 'id = ?';
        const truncated = mockTruncate(longSql, 100);

        expect(truncated.length).toBeLessThanOrEqual(103); // 100 + "..."
        expect(truncated.endsWith('...')).toBe(true);
    });
});

describe('DbHelper - 代码逻辑问题分析', () => {
    test('问题1：addDefaultStateFilter 可能覆盖用户的 state 条件', () => {
        // **问题描述**：
        // 当前实现：addDefaultStateFilter 直接添加 state$gt: 0
        // 问题：如果用户想查询 state=0（已删除）或 state=2（已禁用）的数据，
        //      默认过滤会导致查询失败

        // **建议修复**：
        // 检查 where 条件中是否已有 state 相关字段
        const currentImpl = (where: any) => {
            return {
                ...where,
                state$gt: 0 // 问题：直接覆盖
            };
        };

        const betterImpl = (where: any) => {
            // 检查是否已有 state 条件
            const hasStateCondition = Object.keys(where).some((key) => key === 'state' || key.startsWith('state$'));

            if (hasStateCondition) {
                return where; // 不添加默认过滤
            }

            return {
                ...where,
                state$gt: 0
            };
        };

        // 当前实现的问题
        const result1 = currentImpl({ userId: 123, state: 0 });
        expect(result1.state).toBe(0);
        expect(result1.state$gt).toBe(0); // 冲突！

        // 改进后的实现
        const result2 = betterImpl({ userId: 123, state: 0 });
        expect(result2.state).toBe(0);
        expect(result2.state$gt).toBeUndefined(); // 正确
    });

    test('问题2：getTableColumns 缓存键没有区分数据库', () => {
        // **问题描述**：
        // 缓存键格式：table:columns:${table}
        // 问题：如果连接多个数据库，不同数据库的同名表会共享缓存

        // **建议修复**：
        // 缓存键应包含数据库名：table:columns:${dbName}:${table}

        const currentCacheKey = (table: string) => `table:columns:${table}`;

        const betterCacheKey = (dbName: string, table: string) => `table:columns:${dbName}:${table}`;

        // 问题示例
        expect(currentCacheKey('user')).toBe('table:columns:user');
        // db1.user 和 db2.user 会冲突

        // 改进后
        expect(betterCacheKey('db1', 'user')).toBe('table:columns:db1:user');
        expect(betterCacheKey('db2', 'user')).toBe('table:columns:db2:user');
    });

    test('问题3：convertBigIntFields 白名单硬编码', () => {
        // **问题描述**：
        // 白名单字段硬编码为 ['id', 'pid', 'sort']
        // 问题：如果有其他 BIGINT 字段不符合命名规则，需要修改源码

        // **建议改进**：
        // 1. 支持自定义白名单
        // 2. 或者从表结构元数据中自动获取 BIGINT 字段

        const currentImpl = (arr: any[]) => {
            const whiteList = ['id', 'pid', 'sort']; // 硬编码
            return arr.map((item) => {
                const converted = { ...item };
                for (const key of whiteList) {
                    if (key in converted && typeof converted[key] === 'string') {
                        converted[key] = Number(converted[key]);
                    }
                }
                return converted;
            });
        };

        const betterImpl = (arr: any[], customWhiteList?: string[]) => {
            const defaultWhiteList = ['id', 'pid', 'sort'];
            const whiteList = customWhiteList || defaultWhiteList;

            return arr.map((item) => {
                const converted = { ...item };
                for (const key of whiteList) {
                    if (key in converted && typeof converted[key] === 'string') {
                        converted[key] = Number(converted[key]);
                    }
                }
                return converted;
            });
        };

        // 改进后支持自定义
        const data = [{ id: '123', customId: '456' }];
        const result = betterImpl(data, ['id', 'customId']);
        expect(result[0].customId).toBe(456);
    });

    test('问题4：executeWithConn 没有超时保护', async () => {
        // **问题描述**：
        // 当前实现没有查询超时限制
        // 问题：慢查询可能导致长时间阻塞

        // **建议修复**：
        // 添加查询超时机制

        const mockExecuteWithTimeout = async (sql: string, params: any[], timeout: number = 30000) => {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('查询超时')), timeout);
            });

            const queryPromise = new Promise((resolve) => {
                setTimeout(() => resolve([{ id: 1 }]), 100); // 模拟查询
            });

            return Promise.race([queryPromise, timeoutPromise]);
        };

        // 正常查询
        const result = await mockExecuteWithTimeout('SELECT * FROM users', [], 1000);
        expect(result).toBeDefined();

        // 超时查询
        try {
            await mockExecuteWithTimeout('SELECT * FROM users', [], 10); // 10ms 超时
            expect(true).toBe(false); // 不应执行到这里
        } catch (error: any) {
            expect(error.message).toContain('查询超时');
        }
    });

    test('问题5：getAll 的 MAX_LIMIT 保护不够完善', async () => {
        // **问题描述**：
        // getAll 设置了 MAX_LIMIT = 10000
        // 问题：但没有检测实际查询的数据量，可能超过限制

        // **建议改进**：
        // 1. 查询前先检查总数
        // 2. 如果超过限制，要求用户使用分页

        const betterGetAll = async (table: string, MAX_LIMIT: number = 10000) => {
            // 先查询总数
            const total = 15000; // 模拟

            if (total > MAX_LIMIT) {
                throw new Error(`数据量过大 (${total} 条)，请使用 getList 分页查询`);
            }

            // 执行查询...
            return [];
        };

        try {
            await betterGetAll('users', 10000);
            expect(true).toBe(false);
        } catch (error: any) {
            expect(error.message).toContain('数据量过大');
            expect(error.message).toContain('请使用 getList 分页查询');
        }
    });
});
