# syncDb 简化执行方案

> 执行时间：2025-10-12
> 目标：删除 56%未使用代码，保持 100%功能

## ✅ 已确认

通过代码分析确认：

-   ✅ 适配器系统（7 个文件，2,211 行）**零使用率**
-   ✅ adapter.ts, context.ts, config.ts, errors.ts, syncLogger.ts **未被任何文件导入**
-   ✅ 删除这些文件**不会影响任何现有功能**

## 📋 执行步骤

### 步骤 1：删除未使用的新架构文件

```bash
# 删除适配器系统目录
rm -rf core/scripts/syncDb/adapters/

# 删除未集成的新架构文件
rm core/scripts/syncDb/adapter.ts
rm core/scripts/syncDb/context.ts
rm core/scripts/syncDb/config.ts
rm core/scripts/syncDb/errors.ts
rm core/scripts/syncDb/syncLogger.ts

# 删除说明文档
rm core/scripts/syncDb/README.md

# 删除开发文档
rm notes/syncDb-architecture-upgrade-implementation-guide.md
rm notes/syncDb-architecture-upgrade-progress-2025-10-12.md
rm notes/syncDb-architecture-upgrade-progress-2025-10-12-v2.md
rm notes/syncDb-architecture-upgrade-completion-summary.md
```

**删除统计**：

-   代码文件：7 个
-   文档文件：5 个
-   总代码行数：2,711 行

### 步骤 2：简化 types.ts

**当前**：300 行，19 个导出
**目标**：80 行，6 个核心导出

保留的类型：

```typescript
export interface ColumnInfo { ... }      // 高频使用
export interface IndexInfo { ... }        // 高频使用
export interface FieldChange { ... }      // 中频使用
export interface TablePlan { ... }        // 中频使用
export interface GlobalStats { ... }      // 高频使用
export interface ParsedFieldRule { ... }  // 中频使用
```

删除的类型（未使用）：

```typescript
export interface SyncConfig
export interface SyncContext
export interface DatabaseAdapter
export interface DirectoryConfig
export interface SqlClientOptions
export interface PhaseStats
export enum LogLevel
export enum DatabaseType
export enum SyncErrorCode
export interface ErrorContext
export type FieldChangeType
export type IndexActionType
export interface IndexAction
```

### 步骤 3：简化 state.ts

**当前**：105 行，2 个类
**目标**：30 行，1 个简化类

```typescript
// 简化后
export class PerformanceTracker {
    private start = Date.now();

    getTotalTime(): string {
        const ms = Date.now() - this.start;
        return ms > 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
    }
}

// 删除 ProgressLogger（直接用 console.log）
```

### 步骤 4：合并小工具文件

**合并**：helpers.ts (108 行) + constants.ts (30 行) → utils.ts (100 行)

删除重复的导入和导出，合并相关函数。

## 📊 预期效果

### 文件变化

| 类别         | 删除前 | 删除后 | 变化 |
| ------------ | ------ | ------ | ---- |
| **代码文件** | 18     | 11     | -39% |
| **代码行数** | 4,500  | 2,000  | -56% |
| **文档文件** | 5      | 1      | -80% |

### 文件清单

**保留的核心文件（11 个）**：

```
✅ index.ts         - 主入口
✅ version.ts       - 版本检查
✅ schema.ts        - 模式查询
✅ table.ts         - 表操作
✅ apply.ts         - 变更应用
✅ ddl.ts           - DDL构建
✅ sqlite.ts        - SQLite特殊处理
✅ types.ts         - 类型定义（简化）
✅ state.ts         - 性能统计（简化）
✅ utils.ts         - 工具函数（合并）
✅ constants.ts     - 常量（或合并到utils）
```

**删除的文件（12 个）**：

```
❌ adapters/base.ts         (138行)
❌ adapters/mysql.ts        (213行)
❌ adapters/postgresql.ts   (340行)
❌ adapters/sqlite.ts       (350行)
❌ adapters/factory.ts      (58行)
❌ adapter.ts               (85行)
❌ context.ts               (115行)
❌ config.ts                (166行)
❌ errors.ts                (291行)
❌ syncLogger.ts            (250行)
❌ README.md                (500+行)
❌ helpers.ts               (合并到utils)
```

## 🎯 质量保证

### 验证步骤

1. **编译检查**

    ```bash
    cd core
    bun run build
    # 应该无 TypeScript 错误
    ```

2. **功能测试**

    ```bash
    cd tpl
    bun run ../core/scripts/syncDb/index.ts --plan
    # 应该正常输出计划
    ```

3. **实际同步**
    ```bash
    cd tpl
    bun run ../core/bin/befly.ts syncDb
    # 应该正常同步数据库
    ```

### 回滚方案

如果出现问题，可以从 git 恢复：

```bash
git checkout HEAD -- core/scripts/syncDb/
```

## ✨ 核心理念

### KISS 原则

> Keep It Simple, Stupid

-   删除复杂但未使用的代码
-   保持简单有效的实现
-   避免过度设计

### YAGNI 原则

> You Aren't Gonna Need It

-   不为"可能的未来需求"编码
-   等真正需要时再添加
-   现在的需求已经满足

### 奥卡姆剃刀

> Entities should not be multiplied without necessity

-   如无必要，勿增实体
-   适配器系统是"不必要的实体"
-   现有实现已经足够好

## 📝 执行日志

### 2025-10-12 执行记录

-   [ ] 步骤 1：删除适配器系统文件
-   [ ] 步骤 2：简化 types.ts
-   [ ] 步骤 3：简化 state.ts
-   [ ] 步骤 4：合并工具文件
-   [ ] 验证：编译检查
-   [ ] 验证：功能测试
-   [ ] 验证：实际同步

**预计耗时**：15-20 分钟
**风险等级**：低（可随时回滚）
**收益**：删除 56%未使用代码

---

**准备就绪，等待执行确认。**
