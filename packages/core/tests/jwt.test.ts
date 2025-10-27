/**
 * JWT 工具测试 - TypeScript 版本
 * 测试 utils/jwt.ts 中的 JWT 功能
 */

import { describe, test, expect } from 'bun:test';
import { Jwt } from '../util.js';
import type { JwtPayload } from '../util.js';

describe('JWT 签名和验证', () => {
    test('sign 应该生成有效的 token', async () => {
        const payload: JwtPayload = {
            userId: '123',
            username: 'testuser',
            role: 'user'
        };

        const token = await Jwt.sign(payload, 'test-secret', '1h');
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3);
    });

    test('verify 应该验证有效的 token', async () => {
        const payload: JwtPayload = {
            userId: '123',
            username: 'testuser',
            role: 'admin'
        };

        const token = await Jwt.sign(payload, 'test-secret', '1h');
        const decoded = await Jwt.verify(token, 'test-secret');

        expect(decoded.userId).toBe('123');
        expect(decoded.username).toBe('testuser');
        expect(decoded.role).toBe('admin');
    });

    test('verify 应该拒绝无效的 token', async () => {
        const invalidToken = 'invalid.token.here';

        try {
            await Jwt.verify(invalidToken, 'test-secret');
            expect(true).toBe(false); // 不应该执行到这里
        } catch (error) {
            expect(error).toBeDefined();
        }
    });

    test('verify 应该拒绝错误密钥签名的 token', async () => {
        const payload: JwtPayload = { userId: '123' };
        const token = await Jwt.sign(payload, 'secret1', '1h');

        try {
            await Jwt.verify(token, 'secret2');
            expect(true).toBe(false); // 不应该执行到这里
        } catch (error) {
            expect(error).toBeDefined();
        }
    });
});

describe('JWT 解码', () => {
    test('decode 应该解码 token 而不验证', async () => {
        const payload: JwtPayload = {
            userId: '456',
            username: 'testuser2'
        };

        const token = await Jwt.sign(payload, 'test-secret', '1h');
        const decoded = await Jwt.decode(token);

        expect(decoded.userId).toBe('456');
        expect(decoded.username).toBe('testuser2');
    });

    test('decode 应该包含标准声明', async () => {
        const payload: JwtPayload = { userId: '789' };
        const token = await Jwt.sign(payload, 'test-secret', '1h');
        const decoded = await Jwt.decode(token);

        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();
        expect(typeof decoded.iat).toBe('number');
        expect(typeof decoded.exp).toBe('number');
    });
});

describe('角色和权限检查', () => {
    test('hasRole 应该正确检查角色', async () => {
        const payload: JwtPayload = { userId: '1', role: 'admin' };
        const token = await Jwt.sign(payload, 'secret', '1h');
        const decoded = await Jwt.verify(token, 'secret');

        expect(Jwt.hasRole(decoded, 'admin')).toBe(true);
        expect(Jwt.hasRole(decoded, 'user')).toBe(false);
    });

    test('hasAnyRole 应该检查多个角色', async () => {
        const payload: JwtPayload = { userId: '1', role: 'editor' };
        const token = await Jwt.sign(payload, 'secret', '1h');
        const decoded = await Jwt.verify(token, 'secret');

        expect(Jwt.hasAnyRole(decoded, ['admin', 'editor'])).toBe(true);
        expect(Jwt.hasAnyRole(decoded, ['admin', 'user'])).toBe(false);
    });

    test('hasPermission 应该检查权限', async () => {
        const payload: JwtPayload = {
            userId: '1',
            permissions: ['read', 'write']
        };
        const token = await Jwt.sign(payload, 'secret', '1h');
        const decoded = await Jwt.verify(token, 'secret');

        expect(Jwt.hasPermission(decoded, 'read')).toBe(true);
        expect(Jwt.hasPermission(decoded, 'write')).toBe(true);
        expect(Jwt.hasPermission(decoded, 'delete')).toBe(false);
    });

    test('hasAllPermissions 应该检查所有权限', async () => {
        const payload: JwtPayload = {
            userId: '1',
            permissions: ['read', 'write', 'update']
        };
        const token = await Jwt.sign(payload, 'secret', '1h');
        const decoded = await Jwt.verify(token, 'secret');

        expect(Jwt.hasAllPermissions(decoded, ['read', 'write'])).toBe(true);
        expect(Jwt.hasAllPermissions(decoded, ['read', 'delete'])).toBe(false);
    });
});

describe('Token 过期', () => {
    test('过期的 token 应该被拒绝', async () => {
        const payload: JwtPayload = { userId: '1' };
        // 创建一个已过期的 token（过期时间为 -1 秒）
        const token = await Jwt.sign(payload, 'secret', '-1s');

        // 等待 token 过期
        await new Promise((resolve) => setTimeout(resolve, 1100));

        try {
            await Jwt.verify(token, 'secret');
            expect(true).toBe(false); // 不应该执行到这里
        } catch (error: any) {
            expect(error.message).toContain('expired');
        }
    }, 2000); // 增加测试超时时间
});

describe('静态便捷方法', () => {
    test('Jwt.create 应该创建 token', async () => {
        const token = await Jwt.create({ userId: '1' });
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
    });

    test('Jwt.check 应该验证 token', async () => {
        const token = await Jwt.create({ userId: '1' });
        const decoded = await Jwt.check(token);
        expect(decoded.userId).toBe('1');
    });

    test('Jwt.parse 应该解析 token', async () => {
        const token = await Jwt.create({ userId: '1', username: 'test' });
        const decoded = await Jwt.parse(token);
        expect(decoded.userId).toBe('1');
        expect(decoded.username).toBe('test');
    });
});
