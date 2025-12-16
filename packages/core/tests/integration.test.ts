import { describe, test, expect } from 'bun:test';
import { XMLParser } from 'fast-xml-parser';
import { Cipher } from '../lib/cipher';
import { Jwt } from '../lib/jwt';
import { Validator } from '../lib/validator';
import { SqlBuilder } from '../lib/sqlBuilder';
import { keysToCamel } from '../utils/keysToCamel';
import { keysToSnake } from '../utils/keysToSnake';

describe('Integration - 密码验证流程', () => {
    test('用户注册：密码加密 + 验证', async () => {
        const password = 'MySecurePass123';

        // 1. 密码加密
        const hashedPassword = await Cipher.hashPassword(password);
        expect(hashedPassword).toBeDefined();
        expect(hashedPassword.length).toBeGreaterThan(0);

        // 2. 密码验证
        const isValid = await Cipher.verifyPassword(password, hashedPassword);
        expect(isValid).toBe(true);

        // 3. 错误密码验证
        const isInvalid = await Cipher.verifyPassword('WrongPassword', hashedPassword);
        expect(isInvalid).toBe(false);
    });
});

describe('Integration - JWT + 权限验证', () => {
    const jwt = new Jwt({
        secret: 'test-integration-secret',
        algorithm: 'HS256',
        expiresIn: '1h'
    });

    test('用户登录：JWT 签名 + 验证', () => {
        // 1. 用户登录生成 token
        const payload = {
            userId: 123,
            username: 'john',
            roles: ['admin', 'user'],
            permissions: ['read', 'write', 'delete']
        };

        const token = jwt.sign(payload);
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');

        // 2. 验证 token
        const verified = jwt.verify(token);
        expect(verified.userId).toBe(123);
        expect(verified.username).toBe('john');
        expect(verified.roles).toContain('admin');
        expect(verified.permissions).toContain('write');
    });
});

describe('Integration - 数据验证 + SQL 构建', () => {
    test('API 请求：验证数据 + 构建查询', () => {
        // 1. 验证用户输入
        const userData = {
            email: 'test@example.com',
            age: 25,
            username: 'john'
        };

        const rules = {
            email: { name: '邮箱', type: 'string', regexp: '@email' },
            age: { name: '年龄', type: 'number', min: 0, max: 150 },
            username: { name: '用户名', type: 'string', min: 2, max: 20 }
        };

        const validationResult = Validator.validate(userData, rules, ['email', 'username']);
        expect(validationResult.code).toBe(0);

        // 2. 验证通过后构建 SQL 查询
        const builder = new SqlBuilder();
        const sqlResult = builder.select(['id', 'username', 'email']).from('users').where({ email: userData.email }).toSelectSql();

        expect(sqlResult.sql).toContain('SELECT');
        expect(sqlResult.sql).toContain('FROM `users`');
        expect(sqlResult.sql).toContain('WHERE `email` = ?');
        expect(sqlResult.params).toContain('test@example.com');
    });

    test('数据插入：验证 + 字段转换 + SQL 构建', () => {
        // 1. 验证数据
        const newUser = {
            userName: 'jane',
            userEmail: 'jane@example.com',
            userAge: 30
        };

        const rules = {
            userName: { name: '用户名', type: 'string', min: 2, max: 20 },
            userEmail: { name: '邮箱', type: 'string', regexp: '@email' },
            userAge: { name: '年龄', type: 'number', min: 0, max: 150 }
        };

        const validationResult = Validator.validate(newUser, rules, ['userName', 'userEmail']);
        expect(validationResult.code).toBe(0);

        // 2. 字段转换（驼峰转下划线）
        const dbData = keysToSnake(newUser);
        expect(dbData.user_name).toBe('jane');
        expect(dbData.user_email).toBe('jane@example.com');
        expect(dbData.user_age).toBe(30);

        // 3. 构建插入 SQL
        const builder = new SqlBuilder();
        const sqlResult = builder.toInsertSql('users', dbData);

        expect(sqlResult.sql).toContain('INSERT INTO `users`');
        expect(sqlResult.params).toContain('jane');
        expect(sqlResult.params).toContain('jane@example.com');
    });
});

describe('Integration - XML 解析 + 数据转换', () => {
    test('XML API 响应：解析 + 字段转换', () => {
        const xmlParser = new XMLParser();

        // 1. 解析 XML 响应
        const xmlData = '<response><user_id>123</user_id><user_name>John</user_name><is_active>true</is_active></response>';
        const parsed = xmlParser.parse(xmlData).response as any;

        expect(parsed.user_id).toBe(123);
        expect(parsed.user_name).toBe('John');
        expect(parsed.is_active).toBe(true);

        // 2. 字段转换（下划线转驼峰）
        const camelData = keysToCamel(parsed);
        expect(camelData.userId).toBe(123);
        expect(camelData.userName).toBe('John');
        expect(camelData.isActive).toBe(true);
    });
});

describe('Integration - 加密 + JWT + 哈希', () => {
    test('安全令牌生成：多层加密', () => {
        // 1. 生成随机字符串作为 secret
        const secret = Cipher.randomString(32);
        expect(secret.length).toBe(32);

        // 2. 对 secret 进行 SHA256 哈希
        const hashedSecret = Cipher.sha256(secret);
        expect(hashedSecret.length).toBe(64);

        // 3. 使用 HMAC 签名
        const data = 'user123:session456';
        const signature = Cipher.hmacSha256(data, hashedSecret);
        expect(signature).toBeDefined();

        // 4. Base64 编码
        const encoded = Cipher.base64Encode(signature);
        expect(encoded).toBeDefined();

        // 5. Base64 解码验证
        const decoded = Cipher.base64Decode(encoded);
        expect(decoded).toBe(signature);
    });
});

describe('Integration - SQL 构建 + 字段转换', () => {
    test('复杂查询：驼峰转下划线 + WHERE 条件 + 排序分页', () => {
        const builder = new SqlBuilder();

        // 1. 原始查询条件（驼峰格式）
        const queryConditions = {
            userId: 123,
            userStatus: 'active',
            createdAt: { $gte: 1609459200000 }
        };

        // 2. 转换为下划线格式
        const dbConditions = keysToSnake(queryConditions);

        // 3. 构建复杂查询
        const sqlResult = builder.select(['id', 'user_name', 'user_email', 'created_at']).from('users').where(dbConditions).orderBy(['created_at#DESC']).limit(20).offset(0).toSelectSql();

        expect(sqlResult.sql).toContain('SELECT');
        expect(sqlResult.sql).toContain('WHERE');
        expect(sqlResult.sql).toContain('ORDER BY');
        expect(sqlResult.sql).toContain('LIMIT 20');
        expect(sqlResult.params.length).toBeGreaterThan(0);
    });
});
