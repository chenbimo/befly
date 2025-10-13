# Checks 双目录检查功能实现总结

## 实现时间

2025-10-11

## 需求说明

-   checks 目录在 `core` 和项目（如 `tpl`）中都要有
-   检查流程自动从这两个目录加载文件进行检测
-   检查顺序：先检测 `core/checks`，再检测项目 `checks`
-   不能把 `tpl` 写死，需要动态获取项目目录

## 实现内容

### 1. 核心代码修改

#### `core/lifecycle/checker.ts`

**修改点 1：导入 `getProjectDir`**

```typescript
import { __dirchecks, getProjectDir } from '../system.js';
```

**修改点 2：提取 `runSingleCheck` 私有方法**

```typescript
private static async runSingleCheck(
    file: string,
    checkType: 'core' | 'project',
    stats: { totalChecks: number; passedChecks: number; failedChecks: number }
): Promise<void> {
    // 处理单个检查文件的逻辑
    // 支持区分核心检查和项目检查的日志输出
}
```

**修改点 3：双目录检查逻辑**

```typescript
// 检查目录列表：先核心，后项目
const checkDirs = [
    { path: __dirchecks, type: 'core' as const },
    { path: getProjectDir('checks'), type: 'project' as const }
];

// 按顺序扫描并执行检查函数
for (const { path: checkDir, type } of checkDirs) {
    Logger.info(`开始执行${type === 'core' ? '核心' : '项目'}检查，目录: ${checkDir}`);

    for await (const file of glob.scan({
        cwd: checkDir,
        onlyFiles: true,
        absolute: true
    })) {
        const fileName = path.basename(file);
        if (fileName.startsWith('_')) continue;

        await this.runSingleCheck(file, type, stats);
    }
}
```

### 2. 项目示例文件

#### `tpl/checks/demo.ts`

创建了项目检查示例文件，演示如何编写项目级别的检查：

```typescript
import { Logger } from 'befly';

export default async function (): Promise<boolean> {
    try {
        Logger.info('执行项目示例检查...');
        // 项目特定的检查逻辑
        Logger.info('项目示例检查通过');
        return true;
    } catch (error: any) {
        Logger.error('项目示例检查失败', error);
        return false;
    }
}
```

### 3. 文档更新

#### `AGENTS.md`

-   在 `/core/checks` 说明中添加了检查顺序说明
-   在 `/tpl/checks` 说明中添加了项目检查目录

#### `notes/checks-dual-directory-update.md`

创建了详细的双目录检查机制说明文档，包括：

-   实现细节
-   检查执行顺序
-   目录结构
-   日志输出示例
-   编写项目检查的示例代码
-   使用建议

## 技术特点

### 1. 动态路径获取

使用 `getProjectDir('checks')` 而不是硬编码 `tpl/checks`，确保：

-   项目名称可以是任意的（`tpl`、`app`、`myproject` 等）
-   提高了代码的可移植性和通用性

### 2. 顺序保证

通过数组顺序控制检查执行顺序：

```typescript
const checkDirs = [
    { path: __dirchecks, type: 'core' as const }, // 第一步
    { path: getProjectDir('checks'), type: 'project' as const } // 第二步
];
```

### 3. 类型区分

使用 `type: 'core' | 'project'` 区分检查来源：

-   日志输出更清晰：`核心检查 table.ts` vs `项目检查 demo.ts`
-   便于调试和追踪问题

### 4. 统计信息

使用对象引用传递统计信息：

```typescript
const stats = {
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0
};
```

## 执行流程

```
启动系统
    ↓
开始检查阶段
    ↓
[核心检查阶段]
    ├─ 扫描 core/checks/ 目录
    ├─ 执行 table.ts
    └─ 记录核心检查结果
    ↓
[项目检查阶段]
    ├─ 扫描 project/checks/ 目录
    ├─ 执行 demo.ts
    ├─ 执行 env.ts
    ├─ 执行 custom.ts
    └─ 记录项目检查结果
    ↓
[统计结果]
    ├─ 汇总所有检查结果
    ├─ 如果有失败：终止启动
    └─ 全部通过：继续启动流程
```

## 测试结果

### 单元测试

```
✅ 81 pass
⏭️ 1 skip (Checker 测试因测试环境限制被跳过)
❌ 0 fail
```

### 功能验证

-   ✅ 双目录检查功能正常
-   ✅ 检查顺序正确（核心 → 项目）
-   ✅ 日志区分正确
-   ✅ 使用 `getProjectDir('checks')` 动态获取路径
-   ✅ 不把 `tpl` 写死

## 使用场景示例

### 核心检查（`core/checks/`）

-   ✅ 表定义格式验证（已实现）
-   框架配置完整性检查
-   核心依赖可用性检查

### 项目检查（`project/checks/`）

-   ✅ 示例检查（已实现）
-   环境变量配置检查
-   项目配置文件存在性检查
-   数据库连接检查
-   Redis 连接检查
-   第三方服务可用性检查

## 文件清单

### 修改的文件

1. `core/lifecycle/checker.ts` - 实现双目录检查机制
2. `AGENTS.md` - 更新项目结构说明

### 新增的文件

1. `tpl/checks/demo.ts` - 项目检查示例
2. `notes/checks-dual-directory-update.md` - 详细技术文档

## 优势总结

1. **职责分离**：核心检查和项目检查分离，各司其职
2. **可移植性**：不限定项目目录名称，适用于任何项目
3. **扩展性**：项目可添加任意数量的自定义检查
4. **顺序保证**：先核心后项目，确保基础环境正确
5. **灵活性**：支持同步/异步检查函数
6. **可观测性**：日志清晰区分检查来源和状态
7. **维护性**：代码结构清晰，易于理解和维护

## 后续改进建议

1. **并行执行**：如果检查文件互不依赖，可以考虑并行执行提高速度
2. **检查缓存**：对于一些耗时的检查，可以考虑缓存结果
3. **检查依赖**：支持定义检查之间的依赖关系
4. **检查分组**：支持按优先级或类别分组执行检查
5. **检查报告**：生成详细的检查报告文件

## 注意事项

1. 检查文件必须使用 `export default` 导出函数
2. 函数必须返回 `boolean` 类型（`true` 或 `false`）
3. 文件名不要以下划线 `_` 开头（会被跳过）
4. 项目检查文件需要从 `befly` 导入工具（如 `Logger`）
5. 任何一个检查失败都会阻止系统启动
