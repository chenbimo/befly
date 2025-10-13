# P1 级别重构方案

> 规划时间: 2025-10-11
> 优先级: P1 (中等重要)
> 预估工作量: 3-4 小时

---

## 重构顺序

### 第一步: 创建标准请求上下文类 ⭐⭐⭐

**原因**: 这是基础设施,后续所有改动都依赖它

### 第二步: 实现中间件链模式 ⭐⭐⭐

**原因**: 提升架构灵活性,为后续扩展打基础

### 第三步: 统一错误处理策略 ⭐⭐

**原因**: 整体优化,提升系统稳定性

---

## 方案 1: 创建标准请求上下文类

### 当前问题

```typescript
// 当前在 router/api.ts 中
const ctx = {
    headers: Object.fromEntries(req.headers.entries()),
    body: {},
    user: {}
};
// ❌ 类型不明确
// ❌ 结构随意
// ❌ 难以扩展
```

### 重构方案

#### 1.1 创建 RequestContext 类

**文件**: `core/types/context.ts` (新建)

```typescript
/**
 * 请求上下文类
 * 提供统一的请求数据访问接口
 */
export class RequestContext {
    /** 原始请求对象 */
    public readonly request: Request;

    /** 请求开始时间 */
    public readonly startTime: number;

    /** 请求参数 (GET/POST) */
    public params: Record<string, any> = {};

    /** 用户信息 (认证后) */
    public user: Record<string, any> = {};

    /** 自定义状态 */
    public state: Record<string, any> = {};

    /** 响应数据 */
    public response?: any;

    constructor(req: Request) {
        this.request = req;
        this.startTime = Date.now();
    }

    // 便捷访问器
    get method(): string {
        return this.request.method;
    }

    get url(): string {
        return this.request.url;
    }

    get headers(): Headers {
        return this.request.headers;
    }

    get ip(): string | null {
        return this.request.headers.get('x-forwarded-for') || this.request.headers.get('x-real-ip') || null;
    }

    get userAgent(): string | null {
        return this.request.headers.get('user-agent');
    }

    // 工具方法
    header(name: string): string | null {
        return this.request.headers.get(name);
    }

    get(key: string): any {
        return this.params[key];
    }

    set(key: string, value: any): void {
        this.params[key] = value;
    }

    // 计算请求耗时
    getElapsedTime(): number {
        return Date.now() - this.startTime;
    }
}
```

#### 1.2 更新中间件接口

**文件**: 各个中间件文件

```typescript
// 修改前
export interface ParseContext {
    body: any;
}

// 修改后
import { RequestContext } from '../types/context.js';
// 直接使用 RequestContext,不需要自定义接口
```

#### 1.3 更新 API 处理器

**文件**: `router/api.ts`

```typescript
// 修改前
const ctx = {
    headers: Object.fromEntries(req.headers.entries()),
    body: {},
    user: {}
};

// 修改后
import { RequestContext } from '../types/context.js';
const ctx = new RequestContext(req);
```

**影响文件**:

-   `core/types/context.ts` - 新建
-   `core/router/api.ts` - 修改
-   `core/middleware/*.ts` - 更新接口
-   `core/types/api.d.ts` - 更新 handler 类型

**预估时间**: 1 小时

---

## 方案 2: 实现中间件链模式

### 当前问题

```typescript
// 在 router/api.ts 中硬编码
await authenticate(req, ctx);
parseGetParams(req, api, ctx);
await executePluginHooks(...);
logRequest(...);
const result = checkPermission(...);
const validateResult = validateParams(...);

// ❌ 顺序固定
// ❌ 无法跳过
// ❌ 难以扩展
```

### 重构方案

#### 2.1 创建中间件系统

**文件**: `core/middleware/chain.ts` (新建)

```typescript
/**
 * 中间件类型定义
 */
export type Middleware = (ctx: RequestContext, next: () => Promise<void>) => Promise<void>;

/**
 * 中间件链
 * 实现 Koa 洋葱模型
 */
export class MiddlewareChain {
    private middlewares: Middleware[] = [];

    /**
     * 添加中间件
     */
    use(middleware: Middleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * 执行中间件链
     */
    async execute(ctx: RequestContext): Promise<void> {
        let index = -1;

        const dispatch = async (i: number): Promise<void> => {
            if (i <= index) {
                throw new Error('next() called multiple times');
            }
            index = i;

            if (i >= this.middlewares.length) {
                return;
            }

            const middleware = this.middlewares[i];
            await middleware(ctx, () => dispatch(i + 1));
        };

        await dispatch(0);
    }

    /**
     * 获取中间件数量
     */
    get size(): number {
        return this.middlewares.length;
    }
}
```

#### 2.2 改造现有中间件

**文件**: `core/middleware/*.ts`

```typescript
// 示例: auth.ts
// 修改前
export async function authenticate(req: Request, ctx: AuthContext): Promise<void>;

// 修改后
export function authMiddleware(): Middleware {
    return async (ctx: RequestContext, next: () => Promise<void>) => {
        const authHeader = ctx.header('authorization');

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const payload = await Jwt.verify(token);
                ctx.user = payload;
            } catch (error) {
                ctx.user = {};
            }
        } else {
            ctx.user = {};
        }

        await next(); // 继续下一个中间件
    };
}
```

#### 2.3 更新 API 路由处理

**文件**: `router/api.ts`

```typescript
// 修改前 - 硬编码执行顺序
await authenticate(req, ctx);
parseGetParams(req, api, ctx);
// ...

// 修改后 - 使用中间件链
import { MiddlewareChain } from '../middleware/chain.js';
import { corsMiddleware } from '../middleware/cors.js';
import { authMiddleware } from '../middleware/auth.js';
import { parserMiddleware } from '../middleware/parser.js';
import { validatorMiddleware } from '../middleware/validator.js';
import { permissionMiddleware } from '../middleware/permission.js';

// 构建中间件链
const chain = new MiddlewareChain().use(corsMiddleware()).use(authMiddleware()).use(parserMiddleware(api)).use(pluginHooksMiddleware(pluginLists, appContext)).use(loggerMiddleware()).use(permissionMiddleware(api)).use(validatorMiddleware(api)).use(handlerMiddleware(api, appContext));

// 执行
const ctx = new RequestContext(req);
await chain.execute(ctx);

// 返回响应
return Response.json(ctx.response, {
    headers: ctx.state.corsHeaders
});
```

**影响文件**:

-   `core/middleware/chain.ts` - 新建
-   `core/middleware/*.ts` - 改造为中间件工厂函数
-   `core/router/api.ts` - 重构为中间件链
-   `core/types/middleware.d.ts` - 更新类型定义

**预估时间**: 1.5-2 小时

---

## 方案 3: 统一错误处理策略

### 当前问题

```typescript
// 不一致的错误处理
if (hadPluginError) {
    Logger.error('...');
    process.exit(1); // 立即退出
}

// API加载失败
Logger.error('...'); // 只记录,继续运行

// 系统检查失败
process.exit(); // 立即退出(无错误码)
```

### 重构方案

#### 3.1 定义错误等级

**文件**: `core/types/error.ts` (新建)

```typescript
/**
 * 错误等级
 */
export enum ErrorLevel {
    /** 严重错误,必须退出 */
    CRITICAL = 'CRITICAL',

    /** 警告,记录后继续 */
    WARNING = 'WARNING',

    /** 信息,仅提示 */
    INFO = 'INFO'
}

/**
 * 错误处理配置
 */
export interface ErrorHandlerConfig {
    /** 错误等级 */
    level: ErrorLevel;

    /** 错误消息 */
    message: string;

    /** 错误详情 */
    error?: Error;

    /** 退出码(仅当level=CRITICAL时) */
    exitCode?: number;

    /** 额外信息 */
    meta?: Record<string, any>;
}

/**
 * 错误处理器
 */
export class ErrorHandler {
    /**
     * 处理错误
     */
    static handle(config: ErrorHandlerConfig): void {
        const { level, message, error, exitCode = 1, meta } = config;

        switch (level) {
            case ErrorLevel.CRITICAL:
                Logger.error({
                    msg: message,
                    level: 'CRITICAL',
                    error: error?.message,
                    stack: error?.stack,
                    ...meta
                });
                Logger.error(`系统即将退出 (退出码: ${exitCode})`);
                process.exit(exitCode);
                break;

            case ErrorLevel.WARNING:
                Logger.warn({
                    msg: message,
                    level: 'WARNING',
                    error: error?.message,
                    stack: error?.stack,
                    ...meta
                });
                break;

            case ErrorLevel.INFO:
                Logger.info({
                    msg: message,
                    level: 'INFO',
                    ...meta
                });
                break;
        }
    }
}
```

#### 3.2 更新错误处理规则

**文件**: 各个生命周期文件

```typescript
// checker.ts
if (failedChecks > 0) {
    ErrorHandler.handle({
        level: ErrorLevel.CRITICAL,
        message: '系统检查失败',
        exitCode: 1,
        meta: { totalChecks, failedChecks }
    });
}

// loader.ts - 插件加载
if (hadPluginError) {
    ErrorHandler.handle({
        level: ErrorLevel.CRITICAL,
        message: '核心插件加载失败',
        exitCode: 1
    });
}

// loader.ts - API加载
if (failedApis > 0) {
    ErrorHandler.handle({
        level: ErrorLevel.WARNING,
        message: `${failedApis} 个API加载失败`,
        meta: { totalApis, failedApis }
    });
}
```

#### 3.3 定义错误等级规则

| 场景          | 等级     | 原因               |
| ------------- | -------- | ------------------ |
| 系统检查失败  | CRITICAL | 基础环境不满足     |
| 核心插件失败  | CRITICAL | 框架无法正常工作   |
| 用户插件失败  | WARNING  | 不影响核心功能     |
| 核心 API 失败 | CRITICAL | 健康检查等必需接口 |
| 用户 API 失败 | WARNING  | 可以部分运行       |
| 配置错误      | CRITICAL | 必需配置缺失       |
| 运行时错误    | WARNING  | 单个请求失败       |

**影响文件**:

-   `core/types/error.ts` - 新建
-   `core/lifecycle/checker.ts` - 更新错误处理
-   `core/lifecycle/loader.ts` - 更新错误处理
-   `core/router/api.ts` - 更新错误处理

**预估时间**: 1 小时

---

## 实施计划

### Phase 1: 准备阶段 (30 分钟)

-   [ ] 备份当前代码
-   [ ] 创建测试用例
-   [ ] 准备回滚方案

### Phase 2: RequestContext (1 小时)

-   [ ] 创建 `types/context.ts`
-   [ ] 更新 `router/api.ts`
-   [ ] 更新中间件接口
-   [ ] 测试验证

### Phase 3: 中间件链 (2 小时)

-   [ ] 创建 `middleware/chain.ts`
-   [ ] 改造所有中间件
-   [ ] 重构 `router/api.ts`
-   [ ] 测试验证

### Phase 4: 错误处理 (1 小时)

-   [ ] 创建 `types/error.ts`
-   [ ] 更新生命周期文件
-   [ ] 统一错误处理
-   [ ] 测试验证

### Phase 5: 验证和文档 (30 分钟)

-   [ ] 完整测试
-   [ ] 性能对比
-   [ ] 更新文档
-   [ ] 发布变更记录

---

## 风险评估

### 高风险

-   ❌ **破坏现有 API** - 需要充分测试
-   ❌ **性能下降** - 中间件链可能增加开销

### 中风险

-   ⚠️ **类型不兼容** - 需要更新所有相关代码
-   ⚠️ **错误处理遗漏** - 需要全面审查

### 低风险

-   ✅ **代码可读性** - 新架构更清晰
-   ✅ **可维护性** - 更容易扩展

---

## 回滚方案

如果重构出现问题:

1. 使用 Git 回滚到重构前的 commit
2. 保留新增的类型定义文件作为参考
3. 记录问题并重新规划

---

## 预期收益

### 架构层面

-   ✅ 更清晰的代码结构
-   ✅ 更灵活的扩展能力
-   ✅ 更统一的错误处理

### 开发体验

-   ✅ 更好的类型安全
-   ✅ 更容易调试
-   ✅ 更方便测试

### 维护成本

-   ✅ 降低维护难度
-   ✅ 减少重复代码
-   ✅ 提升代码质量

---

## 是否开始实施?

**建议**:

1. 先实施 **RequestContext** (风险最低,收益明显)
2. 根据效果决定是否继续 **中间件链**
3. 最后统一 **错误处理**

**需要您确认**:

-   [ ] 同意按照此方案重构
-   [ ] 先做 RequestContext,观察效果
-   [ ] 暂缓,需要更多讨论

请告诉我您的决定! 🚀
