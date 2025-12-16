import { describe, test, expect } from 'bun:test';
import { Jwt } from '../lib/jwt';

const jwt = new Jwt({
    secret: 'test-secret',
    algorithm: 'HS256',
    expiresIn: '7d'
});

describe('JWT - sign', () => {
    test('签名创建 token', () => {
        const token = jwt.sign({ userId: 1, name: 'test' });
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3);
    });

    test('自定义密钥', () => {
        const secret = 'custom-secret';
        const token = jwt.sign({ userId: 1 }, { secret: secret });
        const decoded = jwt.verify(token, { secret: secret });
        expect(decoded.userId).toBe(1);
    });
});

describe('JWT - verify', () => {
    test('验证有效 token', () => {
        const token = jwt.sign({ userId: 123, email: 'test@test.com' });
        const decoded = jwt.verify(token);
        expect(decoded.userId).toBe(123);
        expect(decoded.email).toBe('test@test.com');
    });

    test('验证过期 token 抛出错误', () => {
        const token = jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        expect(() => jwt.verify(token)).toThrow();
    });

    test('忽略过期验证', () => {
        const token = jwt.sign({ userId: 1 }, { expiresIn: '-1s' });
        const decoded = jwt.verify(token, { ignoreExpiration: true });
        expect(decoded.userId).toBe(1);
    });

    test('密钥不匹配验证失败', () => {
        const token = jwt.sign({ userId: 1 }, { secret: 'secret1' });
        expect(() => jwt.verify(token, { secret: 'secret2' })).toThrow();
    });
});

describe('JWT - decode', () => {
    test('解码不验证签名', () => {
        const token = jwt.sign({ userId: 456 });
        const decoded = jwt.decode(token);
        expect(decoded.userId).toBe(456);
    });

    test('解码完整信息', () => {
        const token = jwt.sign({ userId: 1 });
        const decoded = jwt.decode(token, true);
        expect(decoded.header).toBeDefined();
        expect(decoded.payload).toBeDefined();
        expect(decoded.signature).toBeDefined();
    });
});
