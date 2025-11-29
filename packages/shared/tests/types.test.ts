/**
 * befly-shared 类型定义测试
 */
import { describe, expect, it } from 'bun:test';

import { ApiCode, ErrorMessages, type DatabaseConfig, type FieldDefinition, type HttpMethod, type MenuItem, type PaginatedResult, type RedisConfig, type ResponseResult, type RoleInfo, type UserInfo, type ValidationResult } from '../src/types.js';

describe('befly-shared 类型定义', () => {
    describe('ResponseResult 类型', () => {
        it('成功响应结构正确', () => {
            const result: ResponseResult<{ id: number }> = {
                code: 0,
                msg: '操作成功',
                data: { id: 1 }
            };
            expect(result.code).toBe(0);
            expect(result.msg).toBe('操作成功');
            expect(result.data).toEqual({ id: 1 });
        });

        it('失败响应结构正确', () => {
            const result: ResponseResult = {
                code: 1,
                msg: '操作失败',
                error: 'Invalid input'
            };
            expect(result.code).toBe(1);
            expect(result.error).toBe('Invalid input');
        });
    });

    describe('PaginatedResult 类型', () => {
        it('分页结果结构正确', () => {
            const result: PaginatedResult<{ name: string }> = {
                code: 0,
                msg: '查询成功',
                data: [{ name: 'test' }],
                total: 100,
                page: 1,
                limit: 10,
                pages: 10
            };
            expect(result.total).toBe(100);
            expect(result.pages).toBe(10);
            expect(result.data).toHaveLength(1);
        });
    });

    describe('ValidationResult 类型', () => {
        it('验证成功结构正确', () => {
            const result: ValidationResult = {
                code: 0,
                fields: {}
            };
            expect(result.code).toBe(0);
        });

        it('验证失败结构正确', () => {
            const result: ValidationResult = {
                code: 1,
                fields: {
                    email: '邮箱格式不正确',
                    password: '密码长度不足'
                }
            };
            expect(result.code).toBe(1);
            expect(Object.keys(result.fields)).toHaveLength(2);
        });
    });

    describe('HttpMethod 类型', () => {
        it('支持所有 HTTP 方法', () => {
            const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
            expect(methods).toHaveLength(7);
        });
    });

    describe('FieldDefinition 类型', () => {
        it('字段定义结构正确', () => {
            const field: FieldDefinition = {
                name: '用户名',
                detail: '用户登录名',
                type: 'string',
                min: 2,
                max: 50,
                default: null,
                index: true,
                unique: true,
                comment: '用户名字段',
                nullable: false,
                unsigned: false,
                regexp: '^[a-zA-Z0-9_]+$'
            };
            expect(field.type).toBe('string');
            expect(field.unique).toBe(true);
        });
    });

    describe('UserInfo 类型', () => {
        it('用户信息结构正确', () => {
            const user: UserInfo = {
                id: 1,
                username: 'admin',
                email: 'admin@example.com',
                roleCode: 'ADMIN',
                customField: 'custom value'
            };
            expect(user.id).toBe(1);
            expect(user.customField).toBe('custom value');
        });
    });

    describe('DatabaseConfig 类型', () => {
        it('数据库配置结构正确', () => {
            const config: DatabaseConfig = {
                type: 'mysql',
                host: 'localhost',
                port: 3306,
                user: 'root',
                password: 'password',
                database: 'befly'
            };
            expect(config.type).toBe('mysql');
            expect(config.port).toBe(3306);
        });
    });

    describe('RedisConfig 类型', () => {
        it('Redis 配置结构正确', () => {
            const config: RedisConfig = {
                host: 'localhost',
                port: 6379,
                password: 'password',
                db: 0
            };
            expect(config.port).toBe(6379);
        });

        it('Redis 配置可选字段', () => {
            const config: RedisConfig = {
                host: 'localhost',
                port: 6379
            };
            expect(config.password).toBeUndefined();
            expect(config.db).toBeUndefined();
        });
    });

    describe('MenuItem 类型', () => {
        it('菜单项结构正确', () => {
            const menu: MenuItem = {
                id: 1,
                pid: 0,
                name: '系统管理',
                path: '/system',
                icon: 'Settings',
                sort: 1,
                hidden: false,
                children: [
                    {
                        id: 2,
                        pid: 1,
                        name: '用户管理',
                        path: '/system/user',
                        sort: 1
                    }
                ]
            };
            expect(menu.children).toHaveLength(1);
            expect(menu.children![0].pid).toBe(1);
        });
    });

    describe('RoleInfo 类型', () => {
        it('角色信息结构正确', () => {
            const role: RoleInfo = {
                id: 1,
                code: 'ADMIN',
                name: '管理员',
                desc: '系统管理员角色'
            };
            expect(role.code).toBe('ADMIN');
        });
    });

    describe('ApiCode 常量', () => {
        it('SUCCESS 值为 0', () => {
            expect(ApiCode.SUCCESS).toBe(0);
        });

        it('FAIL 值为 1', () => {
            expect(ApiCode.FAIL).toBe(1);
        });

        it('UNAUTHORIZED 值为 401', () => {
            expect(ApiCode.UNAUTHORIZED).toBe(401);
        });

        it('FORBIDDEN 值为 403', () => {
            expect(ApiCode.FORBIDDEN).toBe(403);
        });

        it('NOT_FOUND 值为 404', () => {
            expect(ApiCode.NOT_FOUND).toBe(404);
        });

        it('SERVER_ERROR 值为 500', () => {
            expect(ApiCode.SERVER_ERROR).toBe(500);
        });
    });

    describe('ErrorMessages 常量', () => {
        it('UNAUTHORIZED 消息正确', () => {
            expect(ErrorMessages.UNAUTHORIZED).toBe('请先登录');
        });

        it('FORBIDDEN 消息正确', () => {
            expect(ErrorMessages.FORBIDDEN).toBe('无访问权限');
        });

        it('NOT_FOUND 消息正确', () => {
            expect(ErrorMessages.NOT_FOUND).toBe('资源不存在');
        });

        it('SERVER_ERROR 消息正确', () => {
            expect(ErrorMessages.SERVER_ERROR).toBe('服务器错误');
        });

        it('INVALID_PARAMS 消息正确', () => {
            expect(ErrorMessages.INVALID_PARAMS).toBe('参数错误');
        });

        it('TOKEN_EXPIRED 消息正确', () => {
            expect(ErrorMessages.TOKEN_EXPIRED).toBe('Token 已过期');
        });

        it('TOKEN_INVALID 消息正确', () => {
            expect(ErrorMessages.TOKEN_INVALID).toBe('Token 无效');
        });
    });

    describe('BaseRequestContext 类型', () => {
        it('请求上下文基础结构正确', () => {
            const { BaseRequestContext } = require('../src/types.js') as { BaseRequestContext: any };
            // BaseRequestContext 是接口，只验证可以创建符合结构的对象
            const ctx = {
                body: { username: 'test' },
                user: { id: 1 },
                now: Date.now(),
                ip: '127.0.0.1',
                route: 'POST/api/user/login',
                requestId: 'abc123'
            };
            expect(ctx.body.username).toBe('test');
            expect(ctx.user.id).toBe(1);
            expect(typeof ctx.now).toBe('number');
            expect(ctx.ip).toBe('127.0.0.1');
        });
    });

    describe('BaseApiRoute 类型', () => {
        it('API 路由基础结构正确', () => {
            // BaseApiRoute 是接口，只验证可以创建符合结构的对象
            const route = {
                name: '用户登录',
                method: 'POST' as const,
                auth: false,
                fields: {},
                required: ['username', 'password']
            };
            expect(route.name).toBe('用户登录');
            expect(route.method).toBe('POST');
            expect(route.auth).toBe(false);
        });

        it('API 路由最小配置', () => {
            const route = {
                name: '测试接口'
            };
            expect(route.name).toBe('测试接口');
        });
    });
});
