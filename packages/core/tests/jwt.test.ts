import { describe, test, expect, beforeAll } from 'bun:test';
import { Jwt } from '../lib/jwt';
import { Env } from '../env.js';

beforeAll(() => {
    Env.JWT_SECRET = 'test-secret';
    Env.JWT_ALGORITHM = 'HS256';
    Env.JWT_EXPIRES_IN = '7d';
});

describe('JWT - 签名和验证', () => {
    test('签名创建 token', () => {
        const token = Jwt.sign({ userId: 1, name: 'test' });
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3);
    });

    test('验证有效 token', () => {
        const token = Jwt.sign({ userId: 123, email: 'test@test.com' });
        const decoded = Jwt.verify(token);
        expect(decoded.userId).toBe(123);
        expect(decoded.email).toBe('test@test.com');
    });

    test('验证过期 token 抛出错误', () => {
        const token = Jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        expect(() => Jwt.verify(token)).toThrow('Token已过期');
    });

    test('忽略过期验证', () => {
        const token = Jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        const decoded = Jwt.verify(token, { ignoreExpiration: true });
        expect(decoded.userId).toBe(1);
    });

    test('自定义密钥', () => {
        const secret = 'custom-secret';
        const token = Jwt.sign({ userId: 1 }, { secret });
        const decoded = Jwt.verify(token, { secret });
        expect(decoded.userId).toBe(1);
    });

    test('密钥不匹配验证失败', () => {
        const token = Jwt.sign({ userId: 1 }, { secret: 'secret1' });
        expect(() => Jwt.verify(token, { secret: 'secret2' })).toThrow('Token签名无效');
    });
});

describe('JWT - 解码', () => {
    test('解码不验证签名', () => {
        const token = Jwt.sign({ userId: 456 });
        const decoded = Jwt.decode(token);
        expect(decoded.userId).toBe(456);
    });

    test('解码完整信息', () => {
        const token = Jwt.sign({ userId: 1 });
        const decoded = Jwt.decode(token, true);
        expect(decoded.header).toBeDefined();
        expect(decoded.payload).toBeDefined();
        expect(decoded.signature).toBeDefined();
    });
});

describe('JWT - 时间相关', () => {
    test('获取剩余时间', () => {
        const token = Jwt.sign({ userId: 1 }, { expiresIn: '1h' });
        const remaining = Jwt.getTimeToExpiry(token);
        expect(remaining).toBeGreaterThan(3500);
    });

    test('检查是否过期', () => {
        const valid = Jwt.sign({ userId: 1 }, { expiresIn: '1h' });
        expect(Jwt.isExpired(valid)).toBe(false);

        const expired = Jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        expect(Jwt.isExpired(expired)).toBe(true);
    });

    test('检查即将过期', () => {
        const longToken = Jwt.sign({ userId: 1 }, { expiresIn: '1h' });
        expect(Jwt.isNearExpiry(longToken, 300)).toBe(false);

        const shortToken = Jwt.sign({ userId: 1 }, { expiresIn: '2m' });
        expect(Jwt.isNearExpiry(shortToken, 300)).toBe(true);
    });
});

describe('JWT - 权限检查', () => {
    test('检查角色', () => {
        const payload = { userId: 1, role: 'admin' };
        expect(Jwt.hasRole(payload, 'admin')).toBe(true);
        expect(Jwt.hasRole(payload, 'user')).toBe(false);
    });

    test('检查权限', () => {
        const payload = { userId: 1, permissions: ['read', 'write'] };
        expect(Jwt.hasPermission(payload, 'read')).toBe(true);
        expect(Jwt.hasPermission(payload, 'delete')).toBe(false);
    });

    test('检查所有权限', () => {
        const payload = { userId: 1, permissions: ['read', 'write', 'delete'] };
        expect(Jwt.hasAllPermissions(payload, ['read', 'write'])).toBe(true);
        expect(Jwt.hasAllPermissions(payload, ['read', 'admin'])).toBe(false);
    });
});

describe('JWT - 快捷方法', () => {
    test('create 和 check', () => {
        const token = Jwt.create({ userId: 789 });
        const decoded = Jwt.check(token);
        expect(decoded.userId).toBe(789);
    });

    test('parse 方法', () => {
        const token = Jwt.create({ userId: 1 });
        const decoded = Jwt.parse(token);
        expect(decoded.userId).toBe(1);
    });
});
