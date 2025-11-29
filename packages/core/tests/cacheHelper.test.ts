/**
 * CacheHelper 单元测试
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { CacheHelper } from '../lib/cacheHelper.js';
import { Logger, setMockLogger } from '../lib/logger.js';
import { RedisKeys } from '../lib/redisKeys.js';

import type { BeflyContext } from '../types/befly.js';

// Mock pino logger
const mockPino = {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    fatal: mock(() => {}),
    trace: mock(() => {}),
    silent: mock(() => {}),
    child: mock(() => mockPino),
    level: 'info'
};

describe('CacheHelper', () => {
    let cacheHelper: CacheHelper;
    let mockBefly: BeflyContext;
    let mockDb: any;
    let mockRedis: any;

    beforeEach(() => {
        // 设置 mock logger
        setMockLogger(mockPino as any);

        // Mock 数据库方法
        mockDb = {
            tableExists: mock(() => Promise.resolve(true)),
            getAll: mock(() => Promise.resolve([]))
        };

        // Mock Redis 方法
        mockRedis = {
            setObject: mock(() => Promise.resolve('OK')),
            getObject: mock(() => Promise.resolve(null)),
            sadd: mock(() => Promise.resolve(1)),
            smembers: mock(() => Promise.resolve([])),
            sismember: mock(() => Promise.resolve(0)),
            del: mock(() => Promise.resolve(1))
        };

        // 创建 mock befly context
        mockBefly = {
            db: mockDb,
            redis: mockRedis
        } as unknown as BeflyContext;

        cacheHelper = new CacheHelper(mockBefly);
    });

    afterEach(() => {
        // 重置 mock logger
        setMockLogger(null);
    });

    describe('cacheApis', () => {
        it('表不存在时跳过缓存', async () => {
            mockDb.tableExists = mock(() => Promise.resolve(false));

            await cacheHelper.cacheApis();

            expect(mockDb.tableExists).toHaveBeenCalledWith('addon_admin_api');
            expect(mockDb.getAll).not.toHaveBeenCalled();
        });

        it('正常缓存接口列表', async () => {
            const apis = [
                { id: 1, name: '登录', path: '/api/login', method: 'POST' },
                { id: 2, name: '用户列表', path: '/api/user/list', method: 'GET' }
            ];
            mockDb.getAll = mock(() => Promise.resolve(apis));

            await cacheHelper.cacheApis();

            expect(mockRedis.setObject).toHaveBeenCalledWith(RedisKeys.apisAll(), apis);
        });

        it('缓存失败时记录警告', async () => {
            mockRedis.setObject = mock(() => Promise.resolve(null));

            await cacheHelper.cacheApis();

            expect(mockPino.warn).toHaveBeenCalled();
        });

        it('异常时记录错误', async () => {
            mockDb.getAll = mock(() => Promise.reject(new Error('DB Error')));

            await cacheHelper.cacheApis();

            expect(mockPino.error).toHaveBeenCalled();
        });
    });

    describe('cacheMenus', () => {
        it('表不存在时跳过缓存', async () => {
            mockDb.tableExists = mock(() => Promise.resolve(false));

            await cacheHelper.cacheMenus();

            expect(mockDb.tableExists).toHaveBeenCalledWith('addon_admin_menu');
            expect(mockDb.getAll).not.toHaveBeenCalled();
        });

        it('正常缓存菜单列表', async () => {
            const menus = [
                { id: 1, pid: 0, name: '首页', path: '/home', sort: 1 },
                { id: 2, pid: 0, name: '用户管理', path: '/user', sort: 2 }
            ];
            mockDb.getAll = mock(() => Promise.resolve(menus));

            await cacheHelper.cacheMenus();

            expect(mockRedis.setObject).toHaveBeenCalledWith(RedisKeys.menusAll(), menus);
        });
    });

    describe('cacheRolePermissions', () => {
        it('表不存在时跳过缓存', async () => {
            mockDb.tableExists = mock((table: string) => {
                if (table === 'addon_admin_api') return Promise.resolve(true);
                if (table === 'addon_admin_role') return Promise.resolve(false);
                return Promise.resolve(false);
            });

            await cacheHelper.cacheRolePermissions();

            expect(mockPino.warn).toHaveBeenCalled();
        });

        it('正常缓存角色权限', async () => {
            const roles = [
                { id: 1, code: 'admin', apis: '1,2,3' },
                { id: 2, code: 'user', apis: '1' }
            ];
            const apis = [
                { id: 1, path: '/api/login', method: 'POST' },
                { id: 2, path: '/api/user/list', method: 'GET' },
                { id: 3, path: '/api/user/del', method: 'POST' }
            ];

            mockDb.getAll = mock((opts: any) => {
                if (opts.table === 'addon_admin_role') return Promise.resolve(roles);
                if (opts.table === 'addon_admin_api') return Promise.resolve(apis);
                return Promise.resolve([]);
            });

            await cacheHelper.cacheRolePermissions();

            // 验证批量删除调用
            expect(mockRedis.del).toHaveBeenCalledTimes(2);

            // 验证批量添加调用
            expect(mockRedis.sadd).toHaveBeenCalledTimes(2);
            expect(mockRedis.sadd).toHaveBeenCalledWith(RedisKeys.roleApis('admin'), ['POST/api/login', 'GET/api/user/list', 'POST/api/user/del']);
            expect(mockRedis.sadd).toHaveBeenCalledWith(RedisKeys.roleApis('user'), ['POST/api/login']);
        });

        it('无有效角色时不执行缓存', async () => {
            const roles = [{ id: 1, code: 'empty', apis: null }];
            const apis = [{ id: 1, path: '/api/login', method: 'POST' }];

            mockDb.getAll = mock((opts: any) => {
                if (opts.table === 'addon_admin_role') return Promise.resolve(roles);
                if (opts.table === 'addon_admin_api') return Promise.resolve(apis);
                return Promise.resolve([]);
            });

            await cacheHelper.cacheRolePermissions();

            expect(mockRedis.sadd).not.toHaveBeenCalled();
        });

        it('使用 Promise.all 并行执行', async () => {
            const roles = [
                { id: 1, code: 'role1', apis: '1' },
                { id: 2, code: 'role2', apis: '1' },
                { id: 3, code: 'role3', apis: '1' }
            ];
            const apis = [{ id: 1, path: '/api/test', method: 'GET' }];

            mockDb.getAll = mock((opts: any) => {
                if (opts.table === 'addon_admin_role') return Promise.resolve(roles);
                if (opts.table === 'addon_admin_api') return Promise.resolve(apis);
                return Promise.resolve([]);
            });

            await cacheHelper.cacheRolePermissions();

            // 3 个角色应该有 3 次删除和 3 次添加操作
            expect(mockRedis.del).toHaveBeenCalledTimes(3);
            expect(mockRedis.sadd).toHaveBeenCalledTimes(3);
        });
    });

    describe('getApis', () => {
        it('返回缓存的接口列表', async () => {
            const apis = [{ id: 1, name: '登录' }];
            mockRedis.getObject = mock(() => Promise.resolve(apis));

            const result = await cacheHelper.getApis();

            expect(result).toEqual(apis);
        });

        it('缓存不存在时返回空数组', async () => {
            mockRedis.getObject = mock(() => Promise.resolve(null));

            const result = await cacheHelper.getApis();

            expect(result).toEqual([]);
        });
    });

    describe('getMenus', () => {
        it('返回缓存的菜单列表', async () => {
            const menus = [{ id: 1, name: '首页' }];
            mockRedis.getObject = mock(() => Promise.resolve(menus));

            const result = await cacheHelper.getMenus();

            expect(result).toEqual(menus);
        });

        it('缓存不存在时返回空数组', async () => {
            mockRedis.getObject = mock(() => Promise.resolve(null));

            const result = await cacheHelper.getMenus();

            expect(result).toEqual([]);
        });
    });

    describe('getRolePermissions', () => {
        it('返回角色的权限列表', async () => {
            const permissions = ['POST/api/login', 'GET/api/user/list'];
            mockRedis.smembers = mock(() => Promise.resolve(permissions));

            const result = await cacheHelper.getRolePermissions('admin');

            expect(mockRedis.smembers).toHaveBeenCalledWith(RedisKeys.roleApis('admin'));
            expect(result).toEqual(permissions);
        });

        it('权限不存在时返回空数组', async () => {
            mockRedis.smembers = mock(() => Promise.resolve(null));

            const result = await cacheHelper.getRolePermissions('unknown');

            expect(result).toEqual([]);
        });
    });

    describe('checkRolePermission', () => {
        it('有权限时返回 true', async () => {
            mockRedis.sismember = mock(() => Promise.resolve(1));

            const result = await cacheHelper.checkRolePermission('admin', 'POST/api/login');

            expect(mockRedis.sismember).toHaveBeenCalledWith(RedisKeys.roleApis('admin'), 'POST/api/login');
            expect(result).toBe(true);
        });

        it('无权限时返回 false', async () => {
            mockRedis.sismember = mock(() => Promise.resolve(0));

            const result = await cacheHelper.checkRolePermission('user', 'POST/api/admin/del');

            expect(result).toBe(false);
        });
    });

    describe('deleteRolePermissions', () => {
        it('删除成功返回 true', async () => {
            mockRedis.del = mock(() => Promise.resolve(1));

            const result = await cacheHelper.deleteRolePermissions('admin');

            expect(mockRedis.del).toHaveBeenCalledWith(RedisKeys.roleApis('admin'));
            expect(result).toBe(true);
        });

        it('不存在时返回 false', async () => {
            mockRedis.del = mock(() => Promise.resolve(0));

            const result = await cacheHelper.deleteRolePermissions('unknown');

            expect(result).toBe(false);
        });
    });

    describe('cacheAll', () => {
        it('按顺序调用三个缓存方法', async () => {
            const callOrder: string[] = [];

            // 使用 spy 记录调用顺序
            const originalCacheApis = cacheHelper.cacheApis.bind(cacheHelper);
            const originalCacheMenus = cacheHelper.cacheMenus.bind(cacheHelper);
            const originalCacheRolePermissions = cacheHelper.cacheRolePermissions.bind(cacheHelper);

            cacheHelper.cacheApis = async () => {
                callOrder.push('apis');
                await originalCacheApis();
            };
            cacheHelper.cacheMenus = async () => {
                callOrder.push('menus');
                await originalCacheMenus();
            };
            cacheHelper.cacheRolePermissions = async () => {
                callOrder.push('permissions');
                await originalCacheRolePermissions();
            };

            await cacheHelper.cacheAll();

            expect(callOrder).toEqual(['apis', 'menus', 'permissions']);
        });
    });
});
