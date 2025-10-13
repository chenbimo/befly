# Checks 双目录检查机制更新

## 更新时间

2025-10-11

## 更新背景

在原有单目录检查的基础上，扩展为支持双目录检查：先检查核心框架的检查文件，再检查项目自定义的检查文件。

## 更新内容

### 修改 `lifecycle/checker.ts`

#### 修改前

-   只从 `core/checks` 单个目录加载检查文件
-   没有区分核心检查和项目检查

```typescript
// 扫描并执行检查函数
for await (const file of glob.scan({
    cwd: __dirchecks,
    onlyFiles: true,
    absolute: true
})) {
    // 执行检查
}
```

#### 修改后

-   从两个目录按顺序加载检查文件：`core/checks` → `项目/checks`
-   使用 `getProjectDir('checks')` 动态获取项目检查目录，不把 `tpl` 写死
-   提取了 `runSingleCheck` 私有方法处理单个检查文件
-   日志中区分核心检查和项目检查

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
        await this.runSingleCheck(file, type, stats);
    }
}
```

#### 新增私有方法

提取了 `runSingleCheck` 方法处理单个检查文件的逻辑：

```typescript
private static async runSingleCheck(
    file: string,
    checkType: 'core' | 'project',
    stats: { totalChecks: number; passedChecks: number; failedChecks: number }
): Promise<void> {
    const fileName = path.basename(file);
    const checkTypeLabel = checkType === 'core' ? '核心' : '项目';

    // 执行检查并更新统计信息
    // ...
}
```

## 检查执行顺序

系统启动时，检查器会按以下顺序执行：

1. **核心检查阶段**（`core/checks/`）

    - 检查框架核心功能的完整性
    - 例如：表定义格式检查

2. **项目检查阶段**（`项目/checks/`）

    - 检查项目特定配置和环境
    - 例如：必需的环境变量、文件存在性等

3. **失败策略**
    - 任何一个检查返回 `false`，系统将中断启动
    - 所有检查通过后，系统继续启动流程

## 目录结构

```
core/
  checks/           # 框架核心检查目录
    table.ts        # 表定义检查（已存在）

project/            # 项目目录（如 tpl/、app/ 等，不限定名称）
  checks/           # 项目自定义检查目录
    demo.ts         # 示例检查
    env.ts          # 环境变量检查
    custom.ts       # 其他自定义检查
```

## 日志输出示例

```
[2025-10-11 10:00:00] INFO - 开始执行核心检查，目录: D:\codes\befly\core\checks
[2025-10-11 10:00:00] INFO - 核心检查 table.ts 通过，耗时: 50.23 毫秒
[2025-10-11 10:00:00] INFO - 开始执行项目检查，目录: D:\codes\befly\tpl\checks
[2025-10-11 10:00:00] INFO - 项目检查 demo.ts 通过，耗时: 5.12 毫秒
[2025-10-11 10:00:00] INFO - 系统检查完成! 总耗时: 60.45 毫秒，总检查数: 2, 通过: 2, 失败: 0
[2025-10-11 10:00:00] INFO - 所有系统检查通过!
```

## 编写项目检查示例

### 示例 1：环境变量检查

```typescript
// project/checks/env.ts
import { Logger } from 'befly';

/**
 * 检查必需的环境变量是否存在
 */
export default function (): boolean {
    const requiredEnvs = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];

    for (const env of requiredEnvs) {
        if (!process.env[env]) {
            Logger.error(`缺少必需的环境变量: ${env}`);
            return false;
        }
    }

    Logger.info('所有必需的环境变量都已配置');
    return true;
}
```

### 示例 2：文件存在性检查

```typescript
// project/checks/files.ts
import { existsSync } from 'node:fs';
import { Logger } from 'befly';

/**
 * 检查必需的配置文件是否存在
 */
export default function (): boolean {
    const requiredFiles = ['config/database.json', 'config/redis.json', 'data/init.sql'];

    for (const file of requiredFiles) {
        if (!existsSync(file)) {
            Logger.error(`缺少必需的文件: ${file}`);
            return false;
        }
    }

    Logger.info('所有必需的文件都存在');
    return true;
}
```

### 示例 3：数据库连接检查

```typescript
// project/checks/database.ts
import { Logger } from 'befly';

/**
 * 检查数据库连接是否正常
 */
export default async function (): Promise<boolean> {
    try {
        // 尝试连接数据库
        await testDatabaseConnection();

        Logger.info('数据库连接正常');
        return true;
    } catch (error: any) {
        Logger.error('数据库连接失败', error);
        return false;
    }
}
```

## 测试结果

-   ✅ 所有现有测试通过（81/81）
-   ✅ 双目录检查功能正常工作
-   ✅ 日志中正确区分核心检查和项目检查
-   ✅ 使用 `getProjectDir('checks')` 动态获取项目目录
-   ✅ 不把项目目录名（如 `tpl`）写死

## 影响范围

-   `core/lifecycle/checker.ts` - 已更新为双目录检查机制
-   `tpl/checks/` - 新增项目检查目录
-   `tpl/checks/demo.ts` - 新增项目检查示例

## 使用建议

### 核心检查（`core/checks/`）

用于框架级别的通用检查：

-   表定义格式验证
-   框架配置完整性检查
-   核心依赖可用性检查

### 项目检查（`project/checks/`）

用于项目特定的检查：

-   环境变量配置检查
-   项目配置文件存在性检查
-   数据库/Redis 连接检查
-   第三方服务可用性检查
-   数据初始化状态检查

## 优势

1. **职责分离**: 核心检查和项目检查分离，职责清晰
2. **可移植性**: 使用 `getProjectDir('checks')` 动态获取路径，不限定项目名称
3. **扩展性**: 项目可以添加任意数量的自定义检查
4. **顺序保证**: 先执行核心检查，确保基础环境正确
5. **灵活性**: 检查文件可以是同步或异步函数
6. **可观测性**: 日志清晰区分检查来源和执行状态
