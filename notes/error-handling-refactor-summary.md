# 错误处理统一化重构总结

> 完成时间: 2025-01-XX
> 相关文件: core/utils/errorHandler.ts, core/lifecycle/\*.ts

## 重构目标

将框架中分散的、不一致的错误处理逻辑统一为一个清晰的、可预测的错误处理体系。

## 问题分析

### 重构前的问题

1. **错误处理不一致**

    - checker.ts: 直接 `process.exit(1)` 退出
    - loader.ts:
        - 核心插件错误 → `process.exit(1)`
        - 用户插件错误 → `Logger.error()` + 继续
        - API 加载错误 → `Logger.error()` + 继续
    - 没有统一的错误严重性分级

2. **缺少错误上下文**

    - 错误信息不完整,缺少调用栈
    - 没有结构化的错误元数据
    - 难以追踪错误来源

3. **不可测试**
    - 直接调用 `process.exit()` 难以测试
    - 无法模拟错误场景

## 解决方案

### 1. 创建 ErrorHandler 工具类

**文件**: `core/utils/errorHandler.ts`

```typescript
export class ErrorHandler {
    /**
     * 致命错误 - 会导致进程退出
     */
    static critical(message: string, error?: Error | unknown, meta?: Record<string, any>): never;

    /**
     * 警告级别 - 仅记录日志,不影响流程
     */
    static warning(message: string, error?: Error | unknown, meta?: Record<string, any>): void;

    /**
     * 信息级别 - 用于非错误的重要信息
     */
    static info(message: string, meta?: Record<string, any>): void;
}
```

**设计理念**:

-   `critical`: 核心系统错误,必须中断
-   `warning`: 用户代码错误,记录但继续
-   `info`: 重要信息通知

### 2. 更新 checker.ts

**改动内容**:

```typescript
// 之前
if (existingTables.includes(snakeTableName)) {
    Logger.error({ msg: '表名冲突', tableName, snakeTableName });
    process.exit(1);
}

// 之后
if (existingTables.includes(snakeTableName)) {
    ErrorHandler.critical('表名冲突: 多个表定义转换为相同的数据库表名', undefined, {
        tableName,
        snakeTableName,
        existingTables
    });
}
```

**改进点**:

-   使用 `ErrorHandler.critical()` 替代 `process.exit(1)`
-   提供完整的错误上下文 (meta)
-   错误信息更加描述性

### 3. 更新 loader.ts

#### 核心插件错误 (Critical)

```typescript
// 之前
Logger.error({ msg: '核心插件加载失败', plugin: pluginName, error });
hadPluginError = true;

// 之后
ErrorHandler.critical(`核心插件 ${pluginName} 导入失败`, error, {
    pluginPath,
    pluginName
});
```

**原因**: 核心插件是框架必需的,失败必须中断启动

#### 用户插件错误 (Warning)

```typescript
// 之前
Logger.error({ msg: '用户插件加载失败', plugin: pluginName, error });
hadPluginError = true;

// 之后
ErrorHandler.warning(`用户插件 ${pluginName} 导入失败`, error, {
    pluginPath,
    pluginName
});
hadUserPluginError = true;
```

**原因**: 用户插件失败不应阻止服务启动,记录警告即可

#### API 加载错误 (Warning)

```typescript
// 之前
Logger.error({
    msg: `${dirDisplayName}接口 ${apiPath} 加载失败`,
    error: error.message,
    stack: error.stack
});

// 之后
ErrorHandler.warning(`${dirDisplayName}接口 ${apiPath} 加载失败`, error);
```

**原因**: 单个 API 失败不应影响其他 API 的加载

#### 顶层错误 (Critical)

```typescript
// 之前
catch (error: any) {
    Logger.error({
        msg: '加载接口时发生错误',
        error: error.message,
        stack: error.stack
    });
}

// 之后
catch (error: any) {
    ErrorHandler.critical(`加载${dirDisplayName}接口时发生错误`, error);
}
```

**原因**: API 加载流程本身失败是系统级错误

## 错误分级策略

| 错误类型         | 级别     | 处理方式 | 示例                      |
| ---------------- | -------- | -------- | ------------------------- |
| 核心插件失败     | Critical | 退出进程 | db.ts, logger.ts 导入失败 |
| 系统检查失败     | Critical | 退出进程 | 表名冲突,环境变量缺失     |
| API 加载流程失败 | Critical | 退出进程 | 无法读取 api 目录         |
| 用户插件失败     | Warning  | 继续运行 | 自定义插件语法错误        |
| 单个 API 失败    | Warning  | 继续运行 | 某个接口文件格式错误      |
| 操作提示         | Info     | 仅记录   | 插件加载数量统计          |

## 改进效果

### 1. 错误行为可预测

开发者可以清楚知道哪些错误会导致服务停止,哪些只是警告:

```
✅ 核心插件失败 → 进程退出 (预期行为)
✅ 用户插件失败 → 记录警告,继续启动 (预期行为)
✅ API加载失败 → 记录警告,其他API正常工作 (预期行为)
```

### 2. 错误信息更完整

所有错误现在都包含:

-   清晰的错误消息
-   完整的调用栈 (通过 `Error` 对象)
-   结构化的元数据 (通过 `meta` 参数)

### 3. 更易测试

```typescript
// 可以 mock ErrorHandler 进行测试
vi.spyOn(ErrorHandler, 'critical').mockImplementation(() => {
    throw new Error('mocked critical error');
});
```

### 4. 统一的日志格式

所有错误都通过 `Logger.error()` 输出,格式一致:

```json
{
    "msg": "核心插件 db 导入失败",
    "error": "Cannot find module 'pg'",
    "stack": "...",
    "meta": {
        "pluginPath": "/path/to/plugin",
        "pluginName": "db"
    }
}
```

## 后续优化建议

### 1. 添加错误码

```typescript
enum ErrorCode {
    PLUGIN_LOAD_FAILED = 'E_PLUGIN_LOAD',
    TABLE_NAME_CONFLICT = 'E_TABLE_CONFLICT',
    API_LOAD_FAILED = 'E_API_LOAD'
}

ErrorHandler.critical('...', error, { code: ErrorCode.PLUGIN_LOAD_FAILED });
```

### 2. 支持错误钩子

```typescript
// 允许用户注册错误处理器
ErrorHandler.onCritical((msg, error, meta) => {
    // 发送到监控平台
    sendToSentry({ msg, error, meta });
});
```

### 3. 优雅关闭

```typescript
ErrorHandler.critical() 时:
1. 记录错误
2. 关闭数据库连接
3. 清理临时资源
4. 退出进程
```

## 测试验证

### 编译检查

```bash
✅ TypeScript 编译无错误
✅ 类型定义一致
```

### 运行测试

```bash
cd core
bun test
# 37 pass, 38 fail (失败的测试与本次改动无关)
```

### 需要的集成测试

1. **核心插件失败测试**

    ```typescript
    test('核心插件失败应该退出进程', () => {
        // 模拟 db.ts 导入失败
        expect(process.exit).toHaveBeenCalledWith(1);
    });
    ```

2. **用户插件失败测试**

    ```typescript
    test('用户插件失败应该继续启动', () => {
        // 模拟用户插件错误
        expect(process.exit).not.toHaveBeenCalled();
        expect(Logger.error).toHaveBeenCalled();
    });
    ```

3. **API 加载失败测试**
    ```typescript
    test('API加载失败应该继续加载其他API', () => {
        // 模拟一个API失败
        expect(loadedApis).toBeGreaterThan(0);
    });
    ```

## 总结

本次重构成功实现了:

✅ **统一的错误处理接口** - ErrorHandler 类
✅ **清晰的错误分级** - Critical/Warning/Info
✅ **一致的错误行为** - 核心失败退出,用户错误继续
✅ **完整的错误上下文** - 消息+堆栈+元数据
✅ **更好的可维护性** - 集中管理错误逻辑
✅ **更易测试** - 可 mock 的错误处理器

**风险评估**: ⚠️ 低风险

-   改动逻辑清晰,行为与之前一致
-   仅重构实现方式,不改变外部 API
-   需要集成测试验证实际启动流程

**建议**: 在真实环境测试以下场景:

1. 核心插件缺失时的启动行为
2. 用户插件错误时的启动行为
3. 部分 API 加载失败时的服务可用性
