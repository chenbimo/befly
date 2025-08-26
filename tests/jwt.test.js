// JWT完整测试套件
// 测试JWT的可用性、可靠性、准确性
import { describe, test, expect } from 'bun:test';
import { Jwt } from '../utils/jwt.js';
import { Jwt as JwtBase } from '../utils/jwt.js';

const SECRET = 'test-secret-key-for-jwt-at-least-32-characters-long';

// === 1. 基础工具类测试 ===
describe('基础工具类测试', () => {
    test('Base64 URL编码解码正确性', () => {
        const original = 'Hello, JWT World! 中文测试 🚀';
        const encoded = JwtBase.base64UrlEncode(original);
        const decoded = JwtBase.base64UrlDecode(encoded);
        expect(decoded).toBe(original);

        // 验证URL安全性（不包含+, /, =）
        expect(encoded).not.toMatch(/[+/=]/);
    });

    test('过期时间解析准确性', () => {
        expect(JwtBase.parseExpiration(3600)).toBe(3600);
        expect(JwtBase.parseExpiration('1h')).toBe(3600);
        expect(JwtBase.parseExpiration('30m')).toBe(1800);
        expect(JwtBase.parseExpiration('7d')).toBe(604800);
        expect(JwtBase.parseExpiration('1000ms')).toBe(1);

        expect(() => JwtBase.parseExpiration('invalid')).toThrow('过期时间格式无效');
    });

    test('HMAC签名一致性', () => {
        const data = 'test.data';
        const signature1 = JwtBase.createSignature('HS256', SECRET, data);
        const signature2 = JwtBase.createSignature('HS256', SECRET, data);
        expect(signature1).toBe(signature2);

        // 不同密钥应产生不同签名
        const signature3 = JwtBase.createSignature('HS256', 'different-secret', data);
        expect(signature1).not.toBe(signature3);
    });

    test('常量时间比较安全性', () => {
        expect(JwtBase.constantTimeCompare('abc', 'abc')).toBe(true);
        expect(JwtBase.constantTimeCompare('abc', 'def')).toBe(false);
        expect(JwtBase.constantTimeCompare('abc', 'abcd')).toBe(false);
        expect(JwtBase.constantTimeCompare('', '')).toBe(true);
    });
});

// === 2. JWT核心功能测试 ===
describe('JWT核心功能测试', () => {
    test('基础签名验证功能', () => {
        const payload = { userId: 123, name: 'testuser', role: 'admin' };
        const token = Jwt.sign(payload, { secret: SECRET });

        // 验证token格式
        const parts = token.split('.');
        expect(parts.length).toBe(3);

        // 验证token内容
        const verified = Jwt.verify(token, { secret: SECRET });
        expect(verified.userId).toBe(123);
        expect(verified.name).toBe('testuser');
        expect(verified.role).toBe('admin');
    });

    test('算法支持完整性', () => {
        const payload = { test: 'data' };
        const algorithms = ['HS256', 'HS384', 'HS512'];

        algorithms.forEach((alg) => {
            const token = Jwt.sign(payload, { algorithm: alg, secret: SECRET });
            const verified = Jwt.verify(token, { secret: SECRET });
            expect(verified.test).toBe('data');

            // 验证header中的算法
            const decoded = Jwt.decode(token, true);
            expect(decoded.header.alg).toBe(alg);
        });
    });

    test('过期时间处理准确性', () => {
        const payload = { test: 'expiry' };

        // 测试各种过期时间格式
        const formats = ['1h', '30m', '3600'];
        formats.forEach((exp) => {
            const token = Jwt.sign(payload, { expiresIn: exp, secret: SECRET });
            const verified = Jwt.verify(token, { secret: SECRET });
            expect(verified.test).toBe('expiry');

            // 验证exp字段存在且为未来时间
            expect(verified.exp).toBeDefined();
            expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        });

        // 测试数字格式
        const token = Jwt.sign(payload, { expiresIn: 7200, secret: SECRET });
        const verified = Jwt.verify(token, { secret: SECRET });
        expect(verified.test).toBe('expiry');
        expect(verified.exp).toBeDefined();
        expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('JWT声明字段完整性', () => {
        const payload = { userId: 123 };
        const options = {
            secret: SECRET,
            issuer: 'test-issuer',
            audience: 'test-audience',
            subject: 'test-subject',
            jwtId: 'test-jwt-id',
            expiresIn: '1h'
        };

        const token = Jwt.sign(payload, options);
        const verified = Jwt.verify(token, {
            secret: SECRET,
            issuer: 'test-issuer',
            audience: 'test-audience',
            subject: 'test-subject'
        });

        expect(verified.iss).toBe('test-issuer');
        expect(verified.aud).toBe('test-audience');
        expect(verified.sub).toBe('test-subject');
        expect(verified.jti).toBe('test-jwt-id');
    });

    test('解码功能完整性', () => {
        const payload = { userId: 123, name: 'test' };
        const token = Jwt.sign(payload, { secret: SECRET });

        // 简单解码
        const simple = Jwt.decode(token);
        expect(simple.userId).toBe(123);
        expect(simple.name).toBe('test');

        // 完整解码
        const complete = Jwt.decode(token, true);
        expect(complete.header.alg).toBe('HS256');
        expect(complete.header.typ).toBe('JWT');
        expect(complete.payload.userId).toBe(123);
        expect(complete.signature).toBeDefined();
    });
});

// === 3. 安全性测试 ===
describe('安全性测试', () => {
    test('签名验证严格性', () => {
        const payload = { test: 'security' };
        const token = Jwt.sign(payload, { secret: SECRET });

        // 错误密钥应验证失败
        expect(() => {
            Jwt.verify(token, { secret: 'wrong-secret' });
        }).toThrow('Token签名无效');

        // 篡改token应验证失败
        const parts = token.split('.');
        const tamperedToken = parts[0] + '.' + parts[1] + '.tampered';
        expect(() => {
            Jwt.verify(tamperedToken, { secret: SECRET });
        }).toThrow('Token签名无效');
    });

    test('时间验证严格性', () => {
        const payload = { test: 'timing' };

        // 已过期token
        const pastTime = Math.floor(Date.now() / 1000) - 3600;
        const expiredPayload = { ...payload, exp: pastTime };
        const header = { alg: 'HS256', typ: 'JWT' };
        const headerB64 = JwtBase.base64UrlEncode(JSON.stringify(header));
        const payloadB64 = JwtBase.base64UrlEncode(JSON.stringify(expiredPayload));
        const signature = JwtBase.createSignature('HS256', SECRET, `${headerB64}.${payloadB64}`);
        const expiredToken = `${headerB64}.${payloadB64}.${signature}`;

        expect(() => {
            Jwt.verify(expiredToken, { secret: SECRET });
        }).toThrow('Token已过期');

        // 软验证应该通过
        const softVerified = Jwt.verifySoft(expiredToken, { secret: SECRET });
        expect(softVerified.test).toBe('timing');
    });

    test('不生效时间验证', () => {
        const payload = { test: 'notbefore' };
        const futureTime = Math.floor(Date.now() / 1000) + 3600;

        const token = Jwt.sign(payload, {
            secret: SECRET,
            notBefore: futureTime
        });

        expect(() => {
            Jwt.verify(token, { secret: SECRET });
        }).toThrow('Token尚未生效');
    });

    test('算法混淆攻击防护', () => {
        const payload = { test: 'algorithm' };
        const token = Jwt.sign(payload, { algorithm: 'HS256', secret: SECRET });

        // 验证token使用正确的算法
        const decoded = Jwt.decode(token, true);
        expect(decoded.header.alg).toBe('HS256');

        // 正常验证应该成功
        const verified = Jwt.verify(token, { secret: SECRET });
        expect(verified.test).toBe('algorithm');

        // 验证不支持的算法会抛出异常
        const invalidAlgToken = token.replace('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0');
        expect(() => {
            Jwt.verify(invalidAlgToken, { secret: SECRET });
        }).toThrow('不支持的算法');
    });
});

// === 4. 错误处理测试 ===
describe('错误处理测试', () => {
    test('输入参数验证', () => {
        // 空载荷
        expect(() => {
            Jwt.sign(null, { secret: SECRET });
        }).toThrow('载荷必须是非空对象');

        // 非对象载荷
        expect(() => {
            Jwt.sign('string', { secret: SECRET });
        }).toThrow('载荷必须是非空对象');

        // 空token
        expect(() => {
            Jwt.verify('', { secret: SECRET });
        }).toThrow('Token必须是非空字符串');

        // 无效token格式
        expect(() => {
            Jwt.verify('invalid.token', { secret: SECRET });
        }).toThrow('JWT格式无效');
    });

    test('缺失密钥处理', () => {
        const payload = { test: 'secret' };

        // 测试完全没有密钥和环境变量的情况
        const originalEnv = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;

        try {
            expect(() => {
                Jwt.sign(payload, {}); // 不传secret且没有环境变量
            }).toThrow('JWT密钥是必需的');

            expect(() => {
                Jwt.verify('token', {}); // 不传secret且没有环境变量
            }).toThrow('JWT密钥是必需的');
        } finally {
            // 恢复环境变量
            if (originalEnv) process.env.JWT_SECRET = originalEnv;
        }
    });

    test('损坏token处理', () => {
        // Base64解码错误
        expect(() => {
            Jwt.decode('invalid@#$.token@#$.signature');
        }).toThrow('JWT解码失败');

        // JSON解析错误
        const invalidHeader = JwtBase.base64UrlEncode('{invalid json}');
        const validPayload = JwtBase.base64UrlEncode('{"test":"data"}');
        const invalidToken = `${invalidHeader}.${validPayload}.signature`;

        expect(() => {
            Jwt.decode(invalidToken);
        }).toThrow('JWT解码失败');
    });
});

// === 5. 应用层功能测试 ===
describe('应用层功能测试', () => {
    test('用户认证token功能', () => {
        const userInfo = { userId: 123, username: 'testuser', role: 'admin' };
        const token = Jwt.signUserToken(userInfo, { secret: SECRET });
        const verified = Jwt.verifyUserToken(token, { secret: SECRET });

        expect(verified.userId).toBe(123);
        expect(verified.username).toBe('testuser');
        expect(verified.role).toBe('admin');
    });

    test('API访问token功能', () => {
        const payload = { apiKey: 'test-key', scope: 'read' };
        const token = Jwt.signAPIToken(payload, { secret: SECRET });
        const verified = Jwt.verifyAPIToken(token, { secret: SECRET });

        expect(verified.apiKey).toBe('test-key');
        expect(verified.scope).toBe('read');
        expect(verified.aud).toBe('api');
    });

    test('刷新token功能', () => {
        const payload = { userId: 123, tokenType: 'refresh' };
        const token = Jwt.signRefreshToken(payload, { secret: SECRET });
        const verified = Jwt.verifyRefreshToken(token, { secret: SECRET });

        expect(verified.userId).toBe(123);
        expect(verified.tokenType).toBe('refresh');
        expect(verified.aud).toBe('refresh');
    });

    test('临时token功能', () => {
        const payload = { action: 'password-reset', userId: 123 };
        const token = Jwt.signTempToken(payload, { secret: SECRET });
        const verified = Jwt.verifyTempToken(token, { secret: SECRET });

        expect(verified.action).toBe('password-reset');
        expect(verified.userId).toBe(123);
        expect(verified.aud).toBe('temporary');
    });

    test('权限验证功能', () => {
        const payload = {
            userId: 123,
            permissions: ['read', 'write', 'delete']
        };
        const token = Jwt.sign(payload, { secret: SECRET });

        // 单一权限验证
        const verified1 = Jwt.verifyWithPermissions(token, 'read', { secret: SECRET });
        expect(verified1.userId).toBe(123);

        // 多权限验证
        const verified2 = Jwt.verifyWithPermissions(token, ['read', 'write'], { secret: SECRET });
        expect(verified2.userId).toBe(123);

        // 权限不足应失败
        expect(() => {
            Jwt.verifyWithPermissions(token, 'admin', { secret: SECRET });
        }).toThrow('权限不足');
    });

    test('角色验证功能', () => {
        const payload = {
            userId: 123,
            role: 'admin',
            roles: ['admin', 'user']
        };
        const token = Jwt.sign(payload, { secret: SECRET });

        // 单一角色验证
        const verified1 = Jwt.verifyWithRoles(token, 'admin', { secret: SECRET });
        expect(verified1.userId).toBe(123);

        // 多角色验证
        const verified2 = Jwt.verifyWithRoles(token, ['admin', 'superuser'], { secret: SECRET });
        expect(verified2.userId).toBe(123);

        // 角色不足应失败
        expect(() => {
            Jwt.verifyWithRoles(token, 'superadmin', { secret: SECRET });
        }).toThrow('角色权限不足');
    });
});

// === 6. 性能测试 ===
describe('性能测试', () => {
    test('签名性能测试', () => {
        const payload = { userId: 123, test: 'performance' };
        const iterations = 1000;

        const startTime = Date.now();
        for (let i = 0; i < iterations; i++) {
            Jwt.sign(payload, { secret: SECRET });
        }
        const endTime = Date.now();

        const avgTime = (endTime - startTime) / iterations;
        console.log(`   ℹ️  签名性能: ${iterations}次操作耗时${endTime - startTime}ms, 平均${avgTime.toFixed(2)}ms/次`);

        // 性能要求：平均每次签名不超过10ms
        expect(avgTime).toBeLessThanOrEqual(10);
    });

    test('验证性能测试', () => {
        const payload = { userId: 123, test: 'performance' };
        const token = Jwt.sign(payload, { secret: SECRET });
        const iterations = 1000;

        const startTime = Date.now();
        for (let i = 0; i < iterations; i++) {
            Jwt.verify(token, { secret: SECRET });
        }
        const endTime = Date.now();

        const avgTime = (endTime - startTime) / iterations;
        console.log(`   ℹ️  验证性能: ${iterations}次操作耗时${endTime - startTime}ms, 平均${avgTime.toFixed(2)}ms/次`);

        // 性能要求：平均每次验证不超过10ms
        expect(avgTime).toBeLessThanOrEqual(10);
    });
});

// === 7. 实用工具测试 ===
describe('实用工具测试', () => {
    test('剩余时间计算', () => {
        const payload = { test: 'expiry' };
        const token = Jwt.sign(payload, { expiresIn: '1h', secret: SECRET });

        const remaining = Jwt.getTimeToExpiry(token);

        // 应该接近3600秒（允许1秒误差）
        expect(Math.abs(remaining - 3600)).toBeLessThanOrEqual(1);

        // 无过期时间的token
        const noExpToken = Jwt.sign(payload, { secret: SECRET });
        expect(Jwt.getTimeToExpiry(noExpToken)).toBe(-1);
    });

    test('过期检查功能', () => {
        const payload = { test: 'expired' };

        // 未过期token
        const validToken = Jwt.sign(payload, { expiresIn: '1h', secret: SECRET });
        expect(Jwt.isExpired(validToken)).toBe(false);

        // 手动构造已过期token
        const pastTime = Math.floor(Date.now() / 1000) - 3600;
        const expiredPayload = { ...payload, exp: pastTime };
        const header = { alg: 'HS256', typ: 'JWT' };
        const headerB64 = JwtBase.base64UrlEncode(JSON.stringify(header));
        const payloadB64 = JwtBase.base64UrlEncode(JSON.stringify(expiredPayload));
        const signature = JwtBase.createSignature('HS256', SECRET, `${headerB64}.${payloadB64}`);
        const expiredToken = `${headerB64}.${payloadB64}.${signature}`;

        expect(Jwt.isExpired(expiredToken)).toBe(true);
    });

    test('即将过期检查', () => {
        const payload = { test: 'near-expiry' };

        // 5分钟后过期
        const nearExpToken = Jwt.sign(payload, { expiresIn: '5m', secret: SECRET });
        expect(Jwt.isNearExpiry(nearExpToken, 600)).toBe(true); // 10分钟阈值
        expect(Jwt.isNearExpiry(nearExpToken, 60)).toBe(false); // 1分钟阈值

        // 1小时后过期
        const farExpToken = Jwt.sign(payload, { expiresIn: '1h', secret: SECRET });
        expect(Jwt.isNearExpiry(farExpToken, 300)).toBe(false); // 5分钟阈值
    });
});

// === 8. 边界条件测试 ===
describe('边界条件测试', () => {
    test('大载荷处理', () => {
        // 创建较大的载荷
        const largePayload = {
            userId: 123,
            data: 'x'.repeat(1000), // 1KB数据
            array: new Array(100).fill().map((_, i) => ({ id: i, value: `item-${i}` }))
        };

        const token = Jwt.sign(largePayload, { secret: SECRET });
        const verified = Jwt.verify(token, { secret: SECRET });

        expect(verified.userId).toBe(123);
        expect(verified.data.length).toBe(1000);
        expect(verified.array.length).toBe(100);
    });

    test('特殊字符处理', () => {
        const specialPayload = {
            chinese: '中文测试内容',
            emoji: '🚀🎉💯',
            special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
            unicode: '\u0000\u001f\u007f\u0080\u00ff'
        };

        const token = Jwt.sign(specialPayload, { secret: SECRET });
        const verified = Jwt.verify(token, { secret: SECRET });

        expect(verified.chinese).toBe('中文测试内容');
        expect(verified.emoji).toBe('🚀🎉💯');
        expect(verified.special).toBe('!@#$%^&*()_+-=[]{}|;:,.<>?');
        expect(verified.unicode).toBe('\u0000\u001f\u007f\u0080\u00ff');
    });

    test('极短密钥处理', () => {
        const payload = { test: 'short-secret' };
        const shortSecret = 'abc';

        // 短密钥应该仍能工作，但不推荐
        const token = Jwt.sign(payload, { secret: shortSecret });
        const verified = Jwt.verify(token, { secret: shortSecret });
        expect(verified.test).toBe('short-secret');
    });

    test('数值边界处理', () => {
        const payload = {
            maxInt: Number.MAX_SAFE_INTEGER,
            minInt: Number.MIN_SAFE_INTEGER,
            zero: 0,
            negative: -123456789
        };

        const token = Jwt.sign(payload, { secret: SECRET });
        const verified = Jwt.verify(token, { secret: SECRET });

        expect(verified.maxInt).toBe(Number.MAX_SAFE_INTEGER);
        expect(verified.minInt).toBe(Number.MIN_SAFE_INTEGER);
        expect(verified.zero).toBe(0);
        expect(verified.negative).toBe(-123456789);
    });
});
