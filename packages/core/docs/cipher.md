# Cipher 加密工具

> 哈希、签名、密码加密与 JWT 令牌

## 目录

- [概述](#概述)
- [Cipher 加密类](#cipher-加密类)
    - [哈希算法](#哈希算法)
    - [HMAC 签名](#hmac-签名)
    - [密码加密](#密码加密)
    - [工具方法](#工具方法)
- [JWT 令牌](#jwt-令牌)
    - [配置选项](#配置选项)
    - [签发令牌](#签发令牌)
    - [验证令牌](#验证令牌)
    - [解码令牌](#解码令牌)
- [插件集成](#插件集成)
- [使用示例](#使用示例)
- [FAQ](#faq)

---

## 概述

Befly 提供两个安全相关的工具：

| 工具     | 说明       | 典型场景                 |
| -------- | ---------- | ------------------------ |
| `Cipher` | 加密工具类 | 数据哈希、签名、密码加密 |
| `Jwt`    | JWT 令牌类 | 用户认证、API 授权       |

---

## Cipher 加密类

### 基本导入

```typescript
import { Cipher } from '../lib/cipher.js';
```

### 哈希算法

#### MD5

```typescript
// 基本用法
const hash = Cipher.md5('hello');
// '5d41402abc4b2a76b9719d911017c592'

// 指定编码
const hashBase64 = Cipher.md5('hello', 'base64');
```

#### SHA-1

```typescript
const hash = Cipher.sha1('hello');
// 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'
```

#### SHA-256

```typescript
const hash = Cipher.sha256('hello');
// '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
```

#### SHA-512

```typescript
const hash = Cipher.sha512('hello');
// '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca...'
```

#### 通用哈希

```typescript
// 支持多种算法
const hash = Cipher.hash('sha256', 'hello');
const hash2 = Cipher.hash('sha384', 'hello');
const hash3 = Cipher.hash('blake2b256', 'hello');
```

#### 支持的算法

| 算法         | 输出长度 | 说明               |
| ------------ | -------- | ------------------ |
| `md5`        | 32       | 不推荐用于安全场景 |
| `sha1`       | 40       | 不推荐用于安全场景 |
| `sha256`     | 64       | 推荐               |
| `sha384`     | 96       | 高安全性           |
| `sha512`     | 128      | 高安全性           |
| `blake2b256` | 64       | 高性能             |
| `blake2b512` | 128      | 高性能             |

#### 输出编码

| 编码        | 说明              |
| ----------- | ----------------- |
| `hex`       | 十六进制（默认）  |
| `base64`    | Base64 编码       |
| `base64url` | URL 安全的 Base64 |

### HMAC 签名

HMAC 使用密钥进行签名，用于数据完整性验证：

```typescript
const key = 'my-secret-key';

// HMAC-MD5
const sig1 = Cipher.hmacMd5(key, 'data');

// HMAC-SHA1
const sig2 = Cipher.hmacSha1(key, 'data');

// HMAC-SHA256（推荐）
const sig3 = Cipher.hmacSha256(key, 'data');

// HMAC-SHA512
const sig4 = Cipher.hmacSha512(key, 'data');

// 通用 HMAC
const sig5 = Cipher.hmac('sha256', key, 'data');
```

#### RSA-SHA256 签名

用于非对称加密签名：

```typescript
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBg...
-----END PRIVATE KEY-----`;

const signature = Cipher.rsaSha256('data to sign', privateKey);
// 或指定编码
const signatureBase64 = Cipher.rsaSha256('data to sign', privateKey, 'base64');
```

### 密码加密

使用 bcrypt 算法加密密码（推荐用于用户密码存储）：

#### 加密密码

```typescript
// 默认配置（推荐）
const hash = await Cipher.hashPassword('123456');
// '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92...'

// 自定义强度（cost 越高越安全但越慢）
const hash2 = await Cipher.hashPassword('123456', { cost: 12 });
```

#### 验证密码

```typescript
const isValid = await Cipher.verifyPassword('123456', storedHash);
if (isValid) {
    // 密码正确
}
```

#### bcrypt 参数说明

| 参数   | 默认值 | 说明                |
| ------ | ------ | ------------------- |
| `cost` | 10     | 计算强度，范围 4-31 |

**cost 选择建议**：

- `10`：一般应用（默认）
- `12`：高安全性应用
- `14+`：极高安全性（性能影响较大）

### 工具方法

#### Base64 编解码

```typescript
// 编码
const encoded = Cipher.base64Encode('hello');
// 'aGVsbG8='

// 解码
const decoded = Cipher.base64Decode('aGVsbG8=');
// 'hello'
```

#### 随机字符串

```typescript
// 生成指定长度的随机十六进制字符串
const random = Cipher.randomString(32);
// 'a1b2c3d4e5f6...'（32位）
```

#### 文件哈希

```typescript
// 计算文件哈希（异步）
const fileHash = await Cipher.hashFile('/path/to/file.txt');
// 默认 SHA-256

// 指定算法
const md5Hash = await Cipher.hashFile('/path/to/file.txt', 'md5');
```

#### 快速哈希（非密码学）

```typescript
// 高性能哈希，用于数据指纹、去重等
const hash = Cipher.fastHash('data');
const hashWithSeed = Cipher.fastHash('data', 12345);
```

---

## JWT 令牌

JWT (JSON Web Token) 用于用户认证和 API 授权。

### 基本导入

```typescript
import { Jwt } from '../lib/jwt.js';

const jwt = new Jwt({
    secret: 'your-secret-key',
    expiresIn: '7d',
    algorithm: 'HS256'
});
```

### 配置选项

#### AuthConfig 接口

```typescript
interface AuthConfig {
    secret?: string; // 密钥
    expiresIn?: string; // 过期时间
    algorithm?: string; // 签名算法
}
```

#### 配置说明

| 属性        | 默认值           | 说明                         |
| ----------- | ---------------- | ---------------------------- |
| `secret`    | `'befly-secret'` | JWT 密钥（生产环境必须修改） |
| `expiresIn` | `'7d'`           | 过期时间                     |
| `algorithm` | `'HS256'`        | 签名算法                     |

#### 过期时间格式

| 格式 | 示例    | 说明    |
| ---- | ------- | ------- |
| 秒   | `3600`  | 3600 秒 |
| 分钟 | `'30m'` | 30 分钟 |
| 小时 | `'2h'`  | 2 小时  |
| 天   | `'7d'`  | 7 天    |
| 周   | `'2w'`  | 2 周    |

#### 支持的算法

| 算法    | 类型   | 说明                 |
| ------- | ------ | -------------------- |
| `HS256` | 对称   | HMAC SHA-256（默认） |
| `HS384` | 对称   | HMAC SHA-384         |
| `HS512` | 对称   | HMAC SHA-512         |
| `RS256` | 非对称 | RSA SHA-256          |
| `RS384` | 非对称 | RSA SHA-384          |
| `RS512` | 非对称 | RSA SHA-512          |
| `ES256` | 非对称 | ECDSA SHA-256        |
| `ES384` | 非对称 | ECDSA SHA-384        |
| `ES512` | 非对称 | ECDSA SHA-512        |

### 签发令牌

```typescript
// 基本用法
const token = jwt.sign({ userId: 123, role: 'admin' });

// 自定义选项
const token2 = jwt.sign(
    { userId: 123 },
    {
        expiresIn: '1h',
        issuer: 'my-app',
        audience: 'users',
        subject: 'auth',
        jwtId: 'unique-id'
    }
);
```

#### JwtSignOptions

| 属性        | 类型   | 说明             |
| ----------- | ------ | ---------------- |
| `expiresIn` | string | 覆盖默认过期时间 |
| `secret`    | string | 覆盖默认密钥     |
| `algorithm` | string | 覆盖默认算法     |
| `issuer`    | string | 签发者 (iss)     |
| `audience`  | string | 受众 (aud)       |
| `subject`   | string | 主题 (sub)       |
| `jwtId`     | string | 唯一标识 (jti)   |
| `notBefore` | number | 生效时间 (nbf)   |

### 验证令牌

```typescript
try {
    const payload = jwt.verify(token);
    console.log(payload.userId); // 123
} catch (error) {
    // 令牌无效或已过期
    console.error(error.message);
}
```

#### JwtVerifyOptions

```typescript
const payload = jwt.verify(token, {
    ignoreExpiration: false, // 是否忽略过期
    ignoreNotBefore: false, // 是否忽略 nbf
    issuer: 'my-app', // 验证签发者
    audience: 'users', // 验证受众
    subject: 'auth', // 验证主题
    algorithms: ['HS256'] // 允许的算法
});
```

### 解码令牌

解码不验证签名，仅解析内容：

```typescript
// 只获取 payload
const payload = jwt.decode(token);
console.log(payload.userId);

// 获取完整信息
const decoded = jwt.decode(token, true);
console.log(decoded.header); // { alg: 'HS256', typ: 'JWT' }
console.log(decoded.payload); // { userId: 123, iat: ..., exp: ... }
console.log(decoded.signature); // 签名字符串
```

---

## 插件集成

### Cipher 插件

```typescript
// 通过 befly 访问
export default {
    name: '示例接口',
    handler: async (befly, ctx) => {
        const hash = befly.cipher.sha256('data');
        const isValid = await befly.cipher.verifyPassword(password, storedHash);
        return Yes('成功');
    }
} as ApiRoute;
```

### JWT 插件

JWT 插件自动读取配置文件中的 `auth` 配置：

```json
// befly.dev.json
{
    "auth": {
        "secret": "your-dev-secret",
        "expiresIn": "7d",
        "algorithm": "HS256"
    }
}
```

```typescript
// 通过 befly 访问
export default {
    name: '登录',
    auth: false,
    handler: async (befly, ctx) => {
        // 签发令牌
        const token = befly.jwt.sign({ userId: user.id, role: user.role });
        return Yes('登录成功', { token: token });
    }
} as ApiRoute;
```

---

## 使用示例

### 示例 1：用户注册

```typescript
export default {
    name: '用户注册',
    auth: false,
    fields: {
        email: { name: '邮箱', type: 'string', regexp: '@email' },
        password: { name: '密码', type: 'string', min: 6, max: 100 }
    },
    required: ['email', 'password'],
    handler: async (befly, ctx) => {
        // 加密密码
        const hashedPassword = await befly.cipher.hashPassword(ctx.body.password);

        // 存储用户
        await befly.db.insData({
            table: 'user',
            data: {
                email: ctx.body.email,
                password: hashedPassword
            }
        });

        return Yes('注册成功');
    }
} as ApiRoute;
```

### 示例 2：用户登录

```typescript
export default {
    name: '用户登录',
    auth: false,
    fields: {
        email: { name: '邮箱', type: 'string', regexp: '@email' },
        password: { name: '密码', type: 'string', min: 6, max: 100 }
    },
    required: ['email', 'password'],
    handler: async (befly, ctx) => {
        // 查询用户
        const user = await befly.db.getDetail({
            table: 'user',
            columns: ['id', 'email', 'password', 'role'],
            where: { email: ctx.body.email }
        });

        if (!user?.id) {
            return No('用户不存在');
        }

        // 验证密码
        const isValid = await befly.cipher.verifyPassword(ctx.body.password, user.password);
        if (!isValid) {
            return No('密码错误');
        }

        // 签发令牌
        const token = befly.jwt.sign({
            userId: user.id,
            role: user.role
        });

        return Yes('登录成功', { token: token });
    }
} as ApiRoute;
```

### 示例 3：API 签名验证

```typescript
export default {
    name: '第三方回调',
    auth: false,
    handler: async (befly, ctx) => {
        const { data, signature, timestamp } = ctx.body;

        // 验证时间戳（5分钟内有效）
        if (Date.now() - timestamp > 5 * 60 * 1000) {
            return No('请求已过期');
        }

        // 验证签名
        const expectedSig = befly.cipher.hmacSha256('api-secret-key', `${data}${timestamp}`);

        if (signature !== expectedSig) {
            return No('签名验证失败');
        }

        // 处理业务逻辑
        return Yes('验证成功');
    }
} as ApiRoute;
```

### 示例 4：文件完整性校验

```typescript
export default {
    name: '上传文件',
    handler: async (befly, ctx) => {
        const { filePath, expectedHash } = ctx.body;

        // 计算文件哈希
        const actualHash = await befly.cipher.hashFile(filePath);

        if (actualHash !== expectedHash) {
            return No('文件校验失败');
        }

        return Yes('文件校验通过');
    }
} as ApiRoute;
```

---

## FAQ

### Q: 密码应该用什么算法加密？

A: 使用 `hashPassword` 方法（bcrypt 算法）。不要使用 MD5、SHA 等哈希算法存储密码。

### Q: JWT secret 应该如何设置？

A:

1. 生产环境必须使用强密钥（32 字符以上随机字符串）
2. 密钥应通过环境变量或配置文件注入
3. 不要在代码中硬编码密钥

```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Q: JWT 过期后如何处理？

A:

1. 客户端检测到 401 错误后引导用户重新登录
2. 或实现 refresh token 机制

### Q: MD5 和 SHA1 还能用吗？

A:

- **不要用于安全场景**（密码、签名等）
- 可以用于非安全场景（文件指纹、缓存键等）
- 推荐使用 SHA-256 或更高

### Q: HMAC 和普通哈希有什么区别？

A:

- **哈希**：单向转换，任何人都能计算
- **HMAC**：带密钥的签名，只有知道密钥才能计算
- HMAC 用于验证数据完整性和来源

### Q: 如何选择 JWT 算法？

A:

- **HS256**：对称算法，简单高效，适合单服务
- **RS256**：非对称算法，适合微服务（私钥签发，公钥验证）
- **ES256**：椭圆曲线，签名更短，性能更好

### Q: bcrypt cost 参数如何选择？

A:

- 参考标准：单次验证耗时约 100-300ms
- 一般应用：`cost=10`（默认）
- 高安全性：`cost=12`
- 每增加 1，耗时翻倍
