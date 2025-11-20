import { describe, test, expect, beforeAll } from 'bun:test';
import { Jwt } from '../lib/jwt';

beforeAll(() => {
    Jwt.configure({
        secret: 'test-secret',
        algorithm: 'HS256',
        expiresIn: '7d'
    });
});

describe('JWT - 签名和验证', () => {
    test('签名创建 token', async () => {
        const token = await Jwt.sign({ userId: 1, name: 'test' });
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3);
    });

    test('验证有效 token', async () => {
        const token = await Jwt.sign({ userId: 123, email: 'test@test.com' });
        const decoded = await Jwt.verify(token);
        expect(decoded.userId).toBe(123);
        expect(decoded.email).toBe('test@test.com');
    });

    test('验证过期 token 抛出错误', async () => {
        const token = await Jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        expect(Jwt.verify(token)).rejects.toThrow('Token 已过期');
    });

    test('忽略过期验证', async () => {
        const token = await Jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        const decoded = await Jwt.verify(token, { ignoreExpiration: true });
        expect(decoded.userId).toBe(1);
    });

    test('自定义密钥', async () => {
        const secret = 'custom-secret';
        const token = await Jwt.sign({ userId: 1 }, { secret });
        const decoded = await Jwt.verify(token, { secret });
        expect(decoded.userId).toBe(1);
    });

    test('密钥不匹配验证失败', async () => {
        const token = await Jwt.sign({ userId: 1 }, { secret: 'secret1' });
        expect(Jwt.verify(token, { secret: 'secret2' })).rejects.toThrow('Token 签名无效');
    });
});

describe('JWT - 解码', () => {
    test('解码不验证签名', async () => {
        const token = await Jwt.sign({ userId: 456 });
        const decoded = Jwt.decode(token);
        expect(decoded.userId).toBe(456);
    });

    test('解码完整信息', async () => {
        const token = await Jwt.sign({ userId: 1 });
        const decoded = Jwt.decode(token, true);
        expect(decoded.header).toBeDefined();
        expect(decoded.payload).toBeDefined();
        expect(decoded.signature).toBeDefined();
    });
});

describe('JWT - 时间相关', () => {
    test('获取剩余时间', async () => {
        const token = await Jwt.sign({ userId: 1 }, { expiresIn: '1h' });
        const remaining = Jwt.getTimeToExpiry(token);
        expect(remaining).toBeGreaterThan(3500);
    });

    test('检查是否过期', async () => {
        const valid = await Jwt.sign({ userId: 1 }, { expiresIn: '1h' });
        expect(Jwt.isExpired(valid)).toBe(false);

        const expired = await Jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        expect(Jwt.isExpired(expired)).toBe(true);
    });

    test('检查即将过期', async () => {
        const longToken = await Jwt.sign({ userId: 1 }, { expiresIn: '1h' });
        expect(Jwt.isNearExpiry(longToken, 300)).toBe(false);

        const shortToken = await Jwt.sign({ userId: 1 }, { expiresIn: '2m' });
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
    test('create 和 check', async () => {
        const token = await Jwt.create({ userId: 789 });
        const decoded = await Jwt.check(token);
        expect(decoded.userId).toBe(789);
    });

    test('parse 方法', async () => {
        const token = await Jwt.create({ userId: 1 });
        const decoded = Jwt.parse(token);
        expect(decoded.userId).toBe(1);
    });
});
