import { describe, expect, it } from 'bun:test';
import { deepTransformKeys } from '../src/deepTransformKeys';

describe('deepTransformKeys', () => {
    describe('预设转换 - camel', () => {
        it('应该转换简单对象的键名为小驼峰', () => {
            const input = { user_id: 123, user_name: 'John' };
            const expected = { userId: 123, userName: 'John' };
            expect(deepTransformKeys(input, 'camel')).toEqual(expected);
        });

        it('应该转换嵌套对象的键名为小驼峰', () => {
            const input = {
                user_id: 123,
                user_info: {
                    first_name: 'John',
                    last_name: 'Doe'
                }
            };
            const expected = {
                userId: 123,
                userInfo: {
                    firstName: 'John',
                    lastName: 'Doe'
                }
            };
            expect(deepTransformKeys(input, 'camel')).toEqual(expected);
        });
    });

    describe('预设转换 - snake', () => {
        it('应该转换简单对象的键名为下划线', () => {
            const input = { userId: 123, userName: 'John' };
            const expected = { user_id: 123, user_name: 'John' };
            expect(deepTransformKeys(input, 'snake')).toEqual(expected);
        });

        it('应该转换嵌套对象的键名为下划线', () => {
            const input = {
                userId: 123,
                userInfo: {
                    firstName: 'John',
                    lastName: 'Doe'
                }
            };
            const expected = {
                user_id: 123,
                user_info: {
                    first_name: 'John',
                    last_name: 'Doe'
                }
            };
            expect(deepTransformKeys(input, 'snake')).toEqual(expected);
        });
    });

    describe('预设转换 - kebab', () => {
        it('应该转换简单对象的键名为短横线', () => {
            const input = { userId: 123, userName: 'John' };
            const expected = { 'user-id': 123, 'user-name': 'John' };
            expect(deepTransformKeys(input, 'kebab')).toEqual(expected);
        });

        it('应该转换嵌套对象的键名为短横线', () => {
            const input = {
                userId: 123,
                userInfo: {
                    firstName: 'John',
                    lastName: 'Doe'
                }
            };
            const expected = {
                'user-id': 123,
                'user-info': {
                    'first-name': 'John',
                    'last-name': 'Doe'
                }
            };
            expect(deepTransformKeys(input, 'kebab')).toEqual(expected);
        });
    });

    describe('预设转换 - pascal', () => {
        it('应该转换简单对象的键名为大驼峰', () => {
            const input = { user_id: 123, user_name: 'John' };
            const expected = { UserId: 123, UserName: 'John' };
            expect(deepTransformKeys(input, 'pascal')).toEqual(expected);
        });

        it('应该转换嵌套对象的键名为大驼峰', () => {
            const input = {
                user_id: 123,
                user_info: {
                    first_name: 'John'
                }
            };
            const expected = {
                UserId: 123,
                UserInfo: {
                    FirstName: 'John'
                }
            };
            expect(deepTransformKeys(input, 'pascal')).toEqual(expected);
        });
    });

    describe('预设转换 - upper', () => {
        it('应该转换简单对象的键名为大写', () => {
            const input = { userId: 123, userName: 'John' };
            const expected = { USERID: 123, USERNAME: 'John' };
            expect(deepTransformKeys(input, 'upper')).toEqual(expected);
        });

        it('应该转换嵌套对象的键名为大写', () => {
            const input = {
                userId: 123,
                userInfo: {
                    firstName: 'John'
                }
            };
            const expected = {
                USERID: 123,
                USERINFO: {
                    FIRSTNAME: 'John'
                }
            };
            expect(deepTransformKeys(input, 'upper')).toEqual(expected);
        });
    });

    describe('预设转换 - lower', () => {
        it('应该转换简单对象的键名为小写', () => {
            const input = { UserId: 123, UserName: 'John' };
            const expected = { userid: 123, username: 'John' };
            expect(deepTransformKeys(input, 'lower')).toEqual(expected);
        });

        it('应该转换嵌套对象的键名为小写', () => {
            const input = {
                UserId: 123,
                UserInfo: {
                    FirstName: 'John'
                }
            };
            const expected = {
                userid: 123,
                userinfo: {
                    firstname: 'John'
                }
            };
            expect(deepTransformKeys(input, 'lower')).toEqual(expected);
        });
    });

    describe('自定义转换函数', () => {
        it('应该使用自定义函数转换键名为大写', () => {
            const input = { user_id: 123, user_name: 'John' };
            const expected = { USER_ID: 123, USER_NAME: 'John' };
            expect(deepTransformKeys(input, (key) => key.toUpperCase())).toEqual(expected);
        });

        it('应该使用自定义函数转换嵌套对象', () => {
            const input = {
                user_id: 123,
                user_info: {
                    first_name: 'John'
                }
            };
            const expected = {
                USER_ID: 123,
                USER_INFO: {
                    FIRST_NAME: 'John'
                }
            };
            expect(deepTransformKeys(input, (key) => key.toUpperCase())).toEqual(expected);
        });

        it('应该支持自定义前缀添加', () => {
            const input = { id: 1, name: 'test' };
            const expected = { prefix_id: 1, prefix_name: 'test' };
            expect(deepTransformKeys(input, (key) => `prefix_${key}`)).toEqual(expected);
        });
    });

    describe('数组处理', () => {
        it('应该转换数组中对象的键名', () => {
            const input = [
                { user_id: 1, user_name: 'Alice' },
                { user_id: 2, user_name: 'Bob' }
            ];
            const expected = [
                { userId: 1, userName: 'Alice' },
                { userId: 2, userName: 'Bob' }
            ];
            expect(deepTransformKeys(input, 'camel')).toEqual(expected);
        });

        it('应该转换嵌套数组和对象', () => {
            const input = {
                user_list: [
                    {
                        user_id: 1,
                        user_tags: [
                            { tag_name: 'vip', tag_level: 5 },
                            { tag_name: 'active', tag_level: 3 }
                        ]
                    }
                ]
            };
            const expected = {
                userList: [
                    {
                        userId: 1,
                        userTags: [
                            { tagName: 'vip', tagLevel: 5 },
                            { tagName: 'active', tagLevel: 3 }
                        ]
                    }
                ]
            };
            expect(deepTransformKeys(input, 'camel')).toEqual(expected);
        });
    });

    describe('边界情况', () => {
        it('应该处理 null 值', () => {
            expect(deepTransformKeys(null, 'camel')).toBeNull();
        });

        it('应该处理 undefined', () => {
            expect(deepTransformKeys(undefined, 'camel')).toBeUndefined();
        });

        it('应该处理基本类型', () => {
            expect(deepTransformKeys('string', 'camel')).toBe('string');
            expect(deepTransformKeys(123, 'camel')).toBe(123);
            expect(deepTransformKeys(true, 'camel')).toBe(true);
        });

        it('应该处理空对象', () => {
            expect(deepTransformKeys({}, 'camel')).toEqual({});
        });

        it('应该处理空数组', () => {
            expect(deepTransformKeys([], 'camel')).toEqual([]);
        });

        it('应该处理混合类型的数组', () => {
            const input = [{ user_id: 1 }, 'string', 123, null, { nested_obj: { deep_key: 'value' } }];
            const expected = [{ userId: 1 }, 'string', 123, null, { nestedObj: { deepKey: 'value' } }];
            expect(deepTransformKeys(input, 'camel')).toEqual(expected);
        });

        it('应该处理深层嵌套的结构', () => {
            const input = {
                level_1: {
                    level_2: {
                        level_3: {
                            deep_key: 'deep_value'
                        }
                    }
                }
            };
            const expected = {
                level1: {
                    level2: {
                        level3: {
                            deepKey: 'deep_value'
                        }
                    }
                }
            };
            expect(deepTransformKeys(input, 'camel')).toEqual(expected);
        });
    });

    describe('循环引用和深度限制', () => {
        it('应该处理循环引用的对象', () => {
            const obj: any = { user_id: 1, user_name: 'test' };
            obj.self = obj; // 循环引用

            const result = deepTransformKeys(obj, 'camel');

            expect(result.userId).toBe(1);
            expect(result.userName).toBe('test');
            // 循环引用的部分应该保持原样
            expect(result.self).toBe(obj);
        });

        it('应该处理循环引用的数组', () => {
            const arr: any = [{ user_id: 1 }];
            arr.push(arr); // 循环引用

            const result = deepTransformKeys(arr, 'camel');

            expect(result[0]).toEqual({ userId: 1 });
            // 循环引用的部分应该保持原样
            expect(result[1]).toBe(arr);
        });

        it('应该遵守 maxDepth 限制', () => {
            const input = {
                level_1: {
                    level_2: {
                        level_3: {
                            deep_key: 'value'
                        }
                    }
                }
            };

            // 限制深度为 2
            const result = deepTransformKeys(input, 'camel', { maxDepth: 2 });

            expect(result.level1).toBeDefined();
            expect(result.level1.level2).toBeDefined();
            // 第 3 层应该保持原样
            expect(result.level1.level2.level_3).toBeDefined();
            expect(result.level1.level2.level_3.deep_key).toBe('value');
        });

        it('应该在深度为 1 时只转换第一层', () => {
            const input = {
                user_id: 1,
                user_info: {
                    first_name: 'John'
                }
            };

            const result = deepTransformKeys(input, 'camel', { maxDepth: 1 });

            expect(result.userId).toBe(1);
            // 第二层应该保持原样
            expect(result.userInfo.first_name).toBe('John');
        });

        it('maxDepth 为 0 时不限制深度', () => {
            const input = {
                l1: { l2: { l3: { l4: { l5: { deep_key: 'value' } } } } }
            };

            const result = deepTransformKeys(input, 'camel', { maxDepth: 0 });

            expect(result.l1.l2.l3.l4.l5.deepKey).toBe('value');
        });

        it('默认 maxDepth 应该足够处理常见深度', () => {
            // 创建 50 层深度的对象（小于默认的 100）
            let obj: any = { deep_key: 'value' };
            for (let i = 0; i < 49; i++) {
                obj = { nested_obj: obj };
            }

            const result = deepTransformKeys(obj, 'camel');

            // 应该能完全转换
            let current = result;
            for (let i = 0; i < 49; i++) {
                expect(current.nestedObj).toBeDefined();
                current = current.nestedObj;
            }
            expect(current.deepKey).toBe('value');
        });
    });

    describe('排除键名功能', () => {
        it('应该排除指定的键名不转换', () => {
            const input = { _id: '123', user_id: 456, user_name: 'John' };
            const result = deepTransformKeys(input, 'camel', { excludeKeys: ['_id'] });

            expect(result._id).toBe('123');
            expect(result.userId).toBe(456);
            expect(result.userName).toBe('John');
        });

        it('应该排除嵌套对象中的指定键名', () => {
            const input = {
                _id: '123',
                user_id: 456,
                user_info: {
                    _id: '789',
                    first_name: 'John',
                    __v: 1
                }
            };
            const result = deepTransformKeys(input, 'camel', { excludeKeys: ['_id', '__v'] });

            expect(result._id).toBe('123');
            expect(result.userId).toBe(456);
            expect(result.userInfo._id).toBe('789');
            expect(result.userInfo.firstName).toBe('John');
            expect(result.userInfo.__v).toBe(1);
        });

        it('应该排除数组中对象的指定键名', () => {
            const input = [
                { _id: '1', user_name: 'Alice' },
                { _id: '2', user_name: 'Bob' }
            ];
            const result = deepTransformKeys(input, 'camel', { excludeKeys: ['_id'] });

            expect(result[0]._id).toBe('1');
            expect(result[0].userName).toBe('Alice');
            expect(result[1]._id).toBe('2');
            expect(result[1].userName).toBe('Bob');
        });

        it('应该支持多个排除键名', () => {
            const input = {
                _id: '123',
                __v: 1,
                created_at: Date.now(),
                user_id: 456,
                user_name: 'John'
            };
            const result = deepTransformKeys(input, 'camel', {
                excludeKeys: ['_id', '__v', 'created_at']
            });

            expect(result._id).toBe('123');
            expect(result.__v).toBe(1);
            expect(result.created_at).toBe(input.created_at);
            expect(result.userId).toBe(456);
            expect(result.userName).toBe('John');
        });

        it('排除键名不存在时应该正常转换', () => {
            const input = { user_id: 1, user_name: 'test' };
            const result = deepTransformKeys(input, 'camel', {
                excludeKeys: ['_id', 'non_existent']
            });

            expect(result.userId).toBe(1);
            expect(result.userName).toBe('test');
        });

        it('空排除列表应该正常转换所有键', () => {
            const input = { user_id: 1, user_name: 'test' };
            const result = deepTransformKeys(input, 'camel', { excludeKeys: [] });

            expect(result.userId).toBe(1);
            expect(result.userName).toBe('test');
        });

        it('应该结合深度限制和排除键名使用', () => {
            const input = {
                _id: '123',
                user_info: {
                    _id: '456',
                    nested: {
                        deep_key: 'value'
                    }
                }
            };
            const result = deepTransformKeys(input, 'camel', {
                maxDepth: 2,
                excludeKeys: ['_id']
            });

            expect(result._id).toBe('123');
            expect(result.userInfo._id).toBe('456');
            // 深度限制，第三层保持原样
            expect(result.userInfo.nested.deep_key).toBe('value');
        });
    });
});
