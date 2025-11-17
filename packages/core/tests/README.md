# Core Tests

Befly 核心包的测试文件。

## 测试文件说明

### 核心功能测试（使用 Bun Test）

- `cipher.test.ts` - 加密工具测试（MD5, SHA, AES, RSA 等）
- `jwt.test.ts` - JWT 工具测试
- `logger.test.ts` - 日志工具测试
- `sqlBuilder.test.ts` - SQL 构建器测试
- `util.test.ts` - 工具函数测试
- `validator.test.ts` - 验证器测试
- `xml.test.ts` - XML 处理测试
- `integration.test.ts` - 集成测试

### DbHelper 字段排除功能测试

- `fields-validate.test.ts` - 字段验证逻辑测试（独立运行）
- `fields-redis-cache.test.ts` - Redis 缓存性能测试（独立运行）
- `fields-exclude.test.ts` - 完整功能测试（需要数据库和 Redis）

## 运行测试

### 运行所有 Bun Test 测试

```bash
cd packages/core
bun test
```

### 运行单个测试文件

```bash
# 使用 Bun Test 框架
bun test tests/cipher.test.ts

# 独立运行（不依赖测试框架）
bun run tests/fields-validate.test.ts
bun run tests/fields-redis-cache.test.ts
```

### 运行字段排除功能测试

```bash
# 1. 验证逻辑测试（快速，无需数据库）
bun run tests/fields-validate.test.ts

# 2. Redis 缓存模拟测试（快速，无需真实 Redis）
bun run tests/fields-redis-cache.test.ts

# 3. 完整功能测试（需要数据库和 Redis）
# 注意：需要先确保端口不被占用
bun run tests/fields-exclude.test.ts
```

## 测试覆盖范围

### Cipher（加密）

- ✅ 哈希算法：MD5, SHA1, SHA256, SHA512
- ✅ 对称加密：AES-128/192/256-CBC/GCM
- ✅ 非对称加密：RSA
- ✅ HMAC 签名
- ✅ 文件哈希

### JWT

- ✅ 签名和验证
- ✅ 过期时间处理
- ✅ Payload 解析

### Logger

- ✅ 日志级别
- ✅ 彩色输出
- ✅ 文件输出

### SqlBuilder

- ✅ SELECT 构建
- ✅ INSERT 构建
- ✅ UPDATE 构建
- ✅ DELETE 构建
- ✅ WHERE 条件
- ✅ JOIN 操作

### Validator

- ✅ 规则解析
- ✅ 类型验证
- ✅ 长度验证
- ✅ 必填验证

### DbHelper 字段排除

- ✅ 空数组（查询所有）
- ✅ 指定字段（包含）
- ✅ 排除字段（感叹号前缀）
- ✅ 混用检测（报错）
- ✅ 星号检测（报错）
- ✅ Redis 缓存性能
- ✅ PM2 cluster 支持

## 注意事项

1. **字段排除测试**的完整功能测试需要：
    - 数据库连接可用
    - Redis 连接可用
    - 端口 3000 未被占用

2. **独立测试**（`fields-validate.test.ts` 和 `fields-redis-cache.test.ts`）可以随时运行，不需要任何依赖。

3. **Bun Test 测试**使用 `bun test` 命令运行，支持：
    - `describe` / `test` / `expect` 语法
    - 并行执行
    - 覆盖率报告

## 添加新测试

### 使用 Bun Test 框架

```typescript
import { describe, test, expect } from 'bun:test';

describe('功能模块', () => {
    test('测试用例', () => {
        const result = someFunction();
        expect(result).toBe(expected);
    });
});
```

### 独立测试脚本

```typescript
/**
 * 独立测试描述
 */

console.log('开始测试...');

// 测试逻辑
function testSomething() {
    // ...
    console.log('✅ 测试通过');
}

testSomething();
```

## 相关文档

- [字段排除功能实现](../../../temp/fields-exclude-implementation.md)
- [Redis 缓存优化](../../../temp/redis-cache-optimization.md)
- [Sync 缓存清理](../../../temp/sync-cache-clear.md)
