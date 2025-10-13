# Checks 目录文件忽略规则

## 更新时间

2025-10-11

## 功能说明

在 `checks` 目录（包括 `core/checks` 和项目 `checks`）中，**以下划线 `_` 开头的文件会被自动忽略**，不会被检查器执行。

## 实现位置

`core/lifecycle/checker.ts` 第 49 行：

```typescript
for await (const file of glob.scan({
    cwd: checkDir,
    onlyFiles: true,
    absolute: true
})) {
    const fileName = path.basename(file);
    if (fileName.startsWith('_')) continue; // 跳过以下划线开头的文件

    // ... 执行检查逻辑
}
```

## 使用场景

### 1. 临时禁用检查

当你想暂时禁用某个检查而不删除文件时，只需在文件名前加下划线：

```
✅ table.ts       -> 会被执行
❌ _table.ts      -> 会被忽略
```

### 2. 开发中的检查

正在开发但尚未完成的检查文件，可以以下划线开头：

```
checks/
  ✅ database.ts       # 已完成，会被执行
  ❌ _performance.ts   # 开发中，暂时忽略
  ❌ _security.ts      # 待实现，暂时忽略
```

### 3. 测试和调试

测试用的检查文件，避免在正式环境中执行：

```
checks/
  ✅ env.ts           # 生产检查
  ❌ _test.ts         # 测试文件，被忽略
  ❌ _debug.ts        # 调试文件，被忽略
```

### 4. 文档和说明文件

如果需要在 checks 目录下放置说明文件：

```
checks/
  ✅ database.ts       # 检查文件
  ❌ _README.md        # 说明文档，被忽略
  ❌ _notes.txt        # 笔记文件，被忽略
```

## 示例

### 正常执行的文件

```typescript
// core/checks/database.ts
export default async function (): Promise<boolean> {
    // 这个文件会被执行
    return true;
}
```

### 被忽略的文件

```typescript
// core/checks/_database.ts
export default async function (): Promise<boolean> {
    // 这个文件不会被执行（文件名以下划线开头）
    return false;
}
```

## 日志输出

忽略的文件不会在日志中出现任何记录，就像它们不存在一样：

```
[2025-10-11 10:00:00] INFO - 开始执行核心检查，目录: D:\codes\befly\core\checks
[2025-10-11 10:00:00] INFO - 核心检查 table.ts 通过，耗时: 50.23 毫秒
# _test.ts 被忽略，不会出现在日志中
[2025-10-11 10:00:00] INFO - 系统检查完成! 总耗时: 60.45 毫秒，总检查数: 1, 通过: 1, 失败: 0
```

## 验证测试

已通过测试验证：

-   ✅ 创建了 `_test.ts` 文件（返回 false 并记录错误日志）
-   ✅ 运行测试后，没有出现错误日志
-   ✅ 检查统计中没有包含此文件
-   ✅ 证明以下划线开头的文件被正确忽略

## 注意事项

1. **只检查文件名**：只检查文件名本身，不检查路径中的其他部分

    - `core/checks/_test.ts` ✅ 被忽略（文件名以 `_` 开头）
    - `core/_hidden/test.ts` ❌ 不会被忽略（只是路径中有 `_`）

2. **大小写敏感**：在 Windows 上不区分大小写，但在 Linux/Mac 上区分

    - `_test.ts` ✅ 被忽略
    - `_Test.ts` ✅ 被忽略（Windows）
    - `_Test.ts` ✅ 被忽略（Linux/Mac）

3. **适用范围**：此规则同时适用于：

    - `core/checks/` 核心检查目录
    - `project/checks/` 项目检查目录

4. **永久禁用**：如果要永久禁用某个检查，建议直接删除文件，而不是重命名
    - 临时禁用：重命名为 `_filename.ts`
    - 永久禁用：直接删除文件

## 最佳实践

### 推荐 ✅

```
checks/
  database.ts          # 生产检查
  _development.ts      # 开发环境专用检查（临时禁用）
  _experimental.ts     # 实验性检查（开发中）
```

### 不推荐 ❌

```
checks/
  database.ts          # 生产检查
  database_old.ts      # 旧版本（应该删除，不是重命名）
  database_backup.ts   # 备份（应该放到其他地方，不是 checks 目录）
```

## 相关文档

-   `AGENTS.md` - 项目结构说明
-   `notes/checks-export-default-update.md` - Checks 导出规范
-   `notes/checks-dual-directory-update.md` - 双目录检查机制
-   `core/lifecycle/checker.ts` - 检查器实现代码
