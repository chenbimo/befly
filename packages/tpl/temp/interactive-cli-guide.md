# Befly CLI 交互式脚本管理器使用指南

## 📋 核心特性

### 1. 纯交互模式

- 运行 `bunx befly` 进入交互模式
- 通过数字选择要执行的脚本
- 所有参数通过交互式问答添加

### 2. 脚本分类

- **内置脚本**：来自 `core/scripts`（如 `syncDb`、`syncDev`）
- **项目脚本**：来自 `tpl/scripts`（如 `syncDev`）
- **组件脚本**：来自 `tpl/addons/*/scripts`（如 `initMenu`、`syncDev`）

### 3. 脚本执行规则

- 选择哪个数字，就执行对应的脚本
- 即使有同名脚本，也会精确执行选中的那个
- 列表按来源分组：内置脚本 → 项目脚本 → 组件脚本

例如，有 3 个 `syncDev`：

```
1. syncDb (内置)
2. syncDev (内置)
3. syncDev (项目)
4. initMenu (组件)
5. syncDev (组件)
```

- 选择 2 → 执行内置的 syncDev
- 选择 3 → 执行项目的 syncDev
- 选择 5 → 执行组件的 syncDev

## 🎯 使用方法

### 启动交互模式

```bash
bunx befly
# 或者
bunx befly <任何参数>  # 参数会被忽略，统一进入交互模式
```

### 显示效果

```
🚀 Befly CLI - 脚本管理器

📦 内置脚本:
   1. syncDb
   2. syncDev

📦 项目脚本:
   3. syncDev

📦 组件脚本:
   4. initMenu
   5. syncDev

请输入脚本编号 (输入 0 或直接回车退出):
```

### 操作流程

1. **选择脚本**：输入数字（1-5），或输入 0/回车退出
2. **添加参数**：提示是否添加 `--plan` 参数（y/n，默认 n）
3. **确认执行**：提示是否执行（y/n，默认 y）

### 示例：选择脚本 1（syncDb）并添加 --plan

```bash
bunx befly

请输入脚本编号 (输入 0 或直接回车退出): 1

✅ 已选择: syncDb
是否添加 --plan 参数? (y/n，直接回车默认为 n): y
是否执行? (y/n，直接回车默认为 y): y

# 开始执行 syncDb --plan
```

## 开发说明

### 添加新脚本

1. **内置脚本**：在 `core/scripts/` 下创建 `.ts` 文件
2. **项目脚本**：在 `tpl/scripts/` 下创建 `.ts` 文件
3. **组件脚本**：在 `tpl/addons/<addonName>/scripts/` 下创建 `.ts` 文件

CLI 会自动扫描这些目录，无需配置。

### 脚本命名规范

- 使用小驼峰或下划线命名（如 `syncDb`、`initMenu`）
- 文件扩展名为 `.ts`
- 脚本名称会自动去除 `.ts` 后缀

### 脚本模板

```typescript
#!/usr/bin/env bun
import { Env, Logger } from 'befly';

// 从命令行参数获取 --plan 标志
const DRY_RUN = process.argv.includes('--plan');

async function main() {
    if (DRY_RUN) {
        Logger.info('[计划] 这里描述脚本将要执行的操作');
        return;
    }

    // 实际执行逻辑
    Logger.info('开始执行...');
    // ...
}

main().catch((error) => {
    Logger.error('执行失败:', error);
    process.exit(1);
});
```

## 🔍 常见问题

### Q: 如何知道执行了哪个来源的脚本？

A: 在日志中会显示脚本路径，或者在脚本内添加日志标识：

```typescript
Logger.info('【项目脚本】syncDev 开始执行...');
```

### Q: 为什么我的脚本没有显示？

A: 检查以下几点：

1. 文件扩展名是否为 `.ts`
2. 文件是否在正确的目录下（`core/scripts`、`tpl/scripts` 或 `tpl/addons/*/scripts`）
3. 文件名是否符合命名规范

### Q: 如何执行特定来源的脚本？

A: 使用数字选择即可精确执行：

```bash
bunx befly

# 列表显示：
# 1. syncDb (内置)
# 2. syncDev (内置)
# 3. syncDev (项目)
# 4. initMenu (组件)
# 5. syncDev (组件)

# 输入 2 → 执行内置的 syncDev
# 输入 3 → 执行项目的 syncDev
# 输入 5 → 执行组件的 syncDev
```

### Q: 如何快速执行脚本而不每次都要交互？

A: 目前仅支持交互模式，这样可以：

- 避免误执行错误的脚本
- 清晰看到所有可用脚本
- 灵活添加 --plan 等参数
- 执行前再次确认

如果需要自动化执行，建议直接使用 `bun` 运行脚本文件：

```bash
# 直接执行脚本文件
bun packages/core/scripts/syncDb.ts --plan
bun packages/tpl/scripts/syncDev.ts
```

### Q: --plan 参数有什么用？

A: 用于预演模式，脚本会输出将要执行的操作但不实际执行，适合：

- 查看脚本将做什么
- 验证参数是否正确
- 避免误操作

## 📊 技术实现

- **脚本扫描**：使用 `Bun.Glob` 扫描目录
- **脚本执行**：使用 `Bun.spawn` 执行子进程
- **交互输入**：使用 Node.js `readline` 模块
- **纯交互模式**：所有执行都通过数字选择，无传统命令行模式

---

**最后更新**: 2025-10-19
