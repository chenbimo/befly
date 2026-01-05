# Logger 日志系统

> Bun 环境下的高性能结构化日志（自定义实现，兼容常见 pino 调用风格）

## 目录

- [概述](#概述)
- [配置选项](#配置选项)
- [使用方法](#使用方法)
- [日志级别](#日志级别)
- [输出格式](#输出格式)
- [日志文件](#日志文件)
- [插件集成](#插件集成)
- [测试 Mock](#测试-mock)
- [最佳实践](#最佳实践)
- [FAQ](#faq)

---

## 概述

Logger 是 Befly 的日志系统，采用 **Bun 环境自定义实现**：

- **高性能**：异步队列 + 批量写入（不阻塞正常逻辑）
- **文件轮转**：按日期切分 + 文件大小滚动
- **多目标**：同时输出到文件和控制台
- **延迟初始化**：首次使用时才创建实例

**核心规则**：项目中**禁止使用 console**，统一使用 `Logger`。

---

## 配置选项

### LoggerConfig 接口

```typescript
interface LoggerConfig {
    debug?: number; // 是否开启调试模式 (0: 关闭, 1: 开启)
    dir?: string; // 日志目录
    console?: number; // 是否输出到控制台 (0: 关闭, 1: 开启)
    maxSize?: number; // 单个日志文件最大大小 (MB)

    // 以下为“日志清洗/截断”配置（可选）：用于避免大对象导致性能抖动
    sanitizeDepth?: number;
    sanitizeNodes?: number;
    sanitizeObjectKeys?: number;
    maxStringLen?: number;
    maxArrayItems?: number;
    excludeFields?: string[];
}
```

### 配置说明

| 属性                 | 类型     | 默认值     | 说明                                        |
| -------------------- | -------- | ---------- | ------------------------------------------- |
| `debug`              | number   | `0`        | 调试模式：0=关闭，1=开启                    |
| `dir`                | string   | `'./logs'` | 日志文件存放目录                            |
| `console`            | number   | `1`        | 控制台输出：0=关闭，1=开启                  |
| `maxSize`            | number   | `10`       | 单文件最大大小（MB）                        |
| `sanitizeDepth`      | number   | `3`        | 日志清洗最大深度（范围 1..10）              |
| `sanitizeNodes`      | number   | `500`      | 日志清洗最大节点数（范围 50..20000）        |
| `sanitizeObjectKeys` | number   | `100`      | 单对象最大 key 数（范围 10..5000）          |
| `maxStringLen`       | number   | `100`      | 单条字符串最大长度（范围 20..200000）       |
| `maxArrayItems`      | number   | `100`      | 数组最大展开元素数（范围 10..5000）         |
| `excludeFields`      | string[] | 内置+用户  | 脱敏字段匹配（支持通配符，如 `*password*`） |

### 配置示例

在配置文件中设置：

```json
// befly.development.json
{
    "logger": {
        "debug": 1,
        "dir": "./logs",
        "console": 1,
        "maxSize": 10
    }
}
```

```json
// befly.production.json
{
    "logger": {
        "debug": 0,
        "dir": "/var/log/befly",
        "console": 0,
        "maxSize": 50
    }
}
```

---

## 使用方法

### 导入 Logger

```typescript
import { Logger } from "../lib/logger";
```

### 日志方法

```typescript
// 信息日志
Logger.info("用户登录成功");
Logger.info({ userId: 123 }, "用户登录成功");

// 警告日志
Logger.warn("配置项不合法");
Logger.warn({ config: "oldOption" }, "配置项不合法");

// 错误日志
Logger.error("数据库连接失败");
Logger.error({ err: error }, "数据库连接失败");

// 调试日志（仅 debug=1 时输出）
Logger.debug("SQL 查询");
Logger.debug({ sql: "SELECT * FROM user", params: [] }, "SQL 查询");
```

### 带上下文的日志

兼容常见 pino 风格：第一个参数为对象时作为上下文，第二个参数为消息：

```typescript
// 推荐：上下文 + 消息
Logger.info({ userId: 123, action: "login" }, "用户登录成功");

// 输出：
// {"level":30,"time":1234567890,"userId":123,"action":"login","msg":"用户登录成功"}

// 记录错误
try {
    await riskyOperation();
} catch (error) {
    Logger.error({ err: error }, "操作失败");
}
```

### 配置方法

```typescript
// 手动配置（通常由插件自动完成）
Logger.configure({
    debug: 1,
    dir: "./custom-logs",
    console: 1,
    maxSize: 20
});
```

---

## 日志级别

### 级别定义

| 级别    | 数值 | 说明     | 使用场景     |
| ------- | ---- | -------- | ------------ |
| `debug` | 20   | 调试信息 | 开发调试     |
| `info`  | 30   | 一般信息 | 正常操作记录 |
| `warn`  | 40   | 警告     | 潜在问题     |
| `error` | 50   | 错误     | 操作失败     |

### 级别控制

- `debug=0`：日志级别为 `info`，只输出 info、warn、error、fatal
- `debug=1`：日志级别为 `debug`，输出所有级别（debug 及以上）

```typescript
// debug=0 时
Logger.debug("这条不会输出"); // ❌ 被过滤
Logger.info("这条会输出"); // ✅
Logger.error("这条会输出"); // ✅

// debug=1 时
Logger.debug("这条会输出"); // ✅
Logger.info("这条会输出"); // ✅
```

---

## 输出格式

### JSON 格式

日志以 JSON 格式输出，便于日志收集和分析：

```json
{
    "level": 30,
    "time": 1703145600000,
    "pid": 12345,
    "hostname": "server-1",
    "msg": "用户登录成功"
}
```

### 带上下文

```json
{
    "level": 30,
    "time": 1703145600000,
    "userId": 123,
    "email": "user@example.com",
    "msg": "用户登录成功"
}
```

### 错误日志

```json
{
    "level": 50,
    "time": 1703145600000,
    "err": {
        "type": "Error",
        "message": "连接超时",
        "stack": "Error: 连接超时\n    at ..."
    },
    "msg": "数据库连接失败"
}
```

---

## 日志文件

### 文件命名

日志文件按日期命名：

```
logs/
├── app.2024-01-01.log
├── app.2024-01-01.1.log
├── app.2024-01-02.log
├── app.2024-01-03.log
├── slow.2024-01-01.log
└── error.2024-01-01.log
└── ...
```

说明：

- `app.*.log`：普通日志
- `slow.*.log`：慢日志镜像（见下方“慢日志”）
- `error.*.log`：错误日志镜像（`Logger.error()` 会额外写一份到这里）
- 当同一天文件超过 `maxSize`（MB）时，会滚动为 `.<n>` 后缀（如 `.1`、`.2`）。

### 文件轮转

内置轮转策略：

- **按日期轮转**：每天创建新文件（`<prefix>.YYYY-MM-DD.log`）
- **按大小轮转**：同一天单文件超过 `maxSize`（MB）会生成 `.<n>` 后缀文件
- **自动创建目录**：目录不存在时会自动创建
- **清理旧文件**：启动后会异步清理超过 1 年的历史日志（只清理 `app./slow./error.` 前缀文件）

### 慢日志

当日志对象中包含 `event: "slow"` 时，会将这条日志额外镜像一份到 `slow.*.log`：

```typescript
Logger.info({ event: "slow", sqlPreview: "SELECT ...", durationMs: 1234 }, "slow query");
```

---

## 插件集成

### Logger 插件

Logger 作为插件自动加载和配置：

```typescript
// plugins/logger.ts
const loggerPlugin: Plugin = {
    after: [],
    async handler(): Promise<typeof Logger> {
        if (beflyConfig.logger) {
            Logger.configure(beflyConfig.logger);
        }
        return Logger;
    }
};
```

### 通过 befly 访问

```typescript
// 在 API handler 中
export default {
    name: "示例接口",
    handler: async (befly, ctx) => {
        befly.logger.info("处理请求");
        befly.logger.debug({ body: ctx.body }, "请求参数");
        return Yes("成功");
    }
} as ApiRoute;
```

### 直接导入

```typescript
// 直接导入使用
import { Logger } from "../lib/logger.ts";

Logger.info("直接使用");
```

---

## 测试 Mock

### 设置 Mock

测试时可以设置 Mock 实例：

```typescript
import { Logger } from "../lib/logger";

const mockLogger = {
    info: (...args: any[]) => args,
    warn: (...args: any[]) => args,
    error: (...args: any[]) => args,
    debug: (...args: any[]) => args
};

// 设置 mock（也可用 setMockLogger(mockLogger)）
Logger.setMock(mockLogger);

// 测试代码...
Logger.info("这条日志会被 mock 处理");

// 清除 mock
Logger.setMock(null);
```

### 测试示例

```typescript
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { Logger } from "../lib/logger";

describe("Logger", () => {
    const mockLogger = {
        info: mock(() => undefined),
        warn: mock(() => undefined),
        error: mock(() => undefined),
        debug: mock(() => undefined)
    };

    beforeEach(() => {
        Logger.setMock(mockLogger);
    });

    afterEach(() => {
        Logger.setMock(null);
    });

    it("should log info message", () => {
        Logger.info("test message");
        expect(mockLogger.info).toHaveBeenCalledWith("test message");
    });
});
```

---

## 最佳实践

### 1. 使用结构化日志

```typescript
// ✅ 推荐：结构化上下文
Logger.info({ userId: 123, action: "login", ip: "192.168.1.1" }, "用户登录");

// ❌ 避免：字符串拼接
Logger.info(`用户 ${userId} 从 ${ip} 登录`);
```

### 2. 错误日志包含堆栈

```typescript
try {
    await riskyOperation();
} catch (error) {
    // ✅ 使用 err 属性保留完整错误信息
    Logger.error({ err: error }, "操作失败");

    // ❌ 避免：只记录消息
    Logger.error(`操作失败: ${error.message}`);
}
```

### 3. 合理使用日志级别

```typescript
// debug: 开发调试信息
Logger.debug({ sql: query, params: params }, "SQL 查询");

// info: 正常业务操作
Logger.info({ userId: 123 }, "用户登录成功");

// warn: 潜在问题，但不影响功能
Logger.warn({ config: "invalidOption" }, "配置项不合法");

// error: 操作失败
Logger.error({ err: error }, "数据库连接失败");
```

### 4. 不要记录敏感信息

```typescript
// ❌ 避免：记录密码、token 等
Logger.info({ password: user.password }, "用户信息");

// ✅ 推荐：只记录必要信息
Logger.info({ userId: user.id, email: user.email }, "用户信息");
```

### 5. 生产环境关闭控制台

```json
// befly.production.json
{
    "logger": {
        "debug": 0,
        "console": 0
    }
}
```

---

## FAQ

### Q: 为什么禁止使用 console？

A:

1. `console` 没有日志级别控制
2. `console` 不支持结构化日志
3. `console` 不支持文件输出
4. Logger 统一管理便于维护和监控

### Q: 日志文件太多怎么办？

A: 可以：

1. 使用日志清理脚本定期删除旧日志
2. 配置日志收集系统（如 ELK）后删除本地日志
3. 使用外部日志服务

### Q: 如何查看实时日志？

A:

```bash
# 使用 tail 命令
tail -f logs/app.2024-01-01.log

# 可选：使用 pino-pretty 格式化（本项目不内置，仅作为外部查看工具）
tail -f logs/app.2024-01-01.log | npx pino-pretty
```

### Q: debug 模式对性能有影响吗？

A: Logger 内部会做级别过滤；关闭 debug 时 `Logger.debug()` 依然会走一次轻量的参数处理，但不会落盘/输出。生产环境建议 `debug=0`。

### Q: 如何添加全局上下文？

A: 当前不提供 `child()` 风格的子 Logger。推荐做法是：

- 在每次调用时显式带上结构化字段（如 `service`、`version`）
- 或者在框架层通过 AsyncLocalStorage 注入请求级 meta（框架已内置）

### Q: 日志没有输出怎么排查？

A: 检查以下几点：

1. 日志级别是否正确（debug 模式是否开启）
2. 日志目录是否有写入权限
3. 是否设置了 mock logger
4. 配置是否正确加载

### Q: 如何在测试中捕获日志？

A: 使用 `Logger.setMock()` 设置 mock 实例，然后断言 mock 函数的调用参数：

```typescript
const mockLogger = { info: mock(() => undefined), warn: mock(() => undefined), error: mock(() => undefined), debug: mock(() => undefined) };
Logger.setMock(mockLogger);

// 执行测试...

expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ userId: 123 }), expect.any(String));
```
