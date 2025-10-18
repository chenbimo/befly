# Befly CLI 交互式脚本管理器使用指南

## 📋 核心特性

### 1. 双模式支持

- **交互模式**：无参数运行 `bunx befly`，通过数字选择脚本
- **传统模式**：直接传脚本名，如 `bunx befly syncDb --plan`

### 2. 脚本分类

- **内置脚本**：来自 `core/scripts`（如 `syncDb`、`syncDev`）
- **项目脚本**：来自 `tpl/scripts`（如 `syncDev`）
- **组件脚本**：来自 `tpl/addons/*/scripts`（如 `initMenu`、`syncDev`）

### 3. 重名处理

当多个来源有同名脚本时（如 `syncDev`），优先级为：

```
项目脚本 > 组件脚本 > 内置脚本
```

例如：

- `bunx befly syncDev` → 执行项目的 syncDev（优先级最高）
- 如果项目没有 syncDev，则执行组件的 syncDev
- 如果组件也没有，最后执行内置的 syncDev

## 🎯 交互模式使用

### 启动交互模式

```bash
bunx befly
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

## 🚀 传统模式使用

### 基本语法

```bash
bunx befly <scriptName> [--plan]
```

### 示例

```bash
# 同步数据库（预演模式）
bunx befly syncDb --plan

# 同步数据库（实际执行）
bunx befly syncDb

# 同步开发管理员（优先执行项目的 syncDev）
bunx befly syncDev

# 初始化菜单（组件脚本）
bunx befly initMenu
```

### 参数说明

- `--plan`：预演模式，只输出计划不执行（DRY_RUN = true）
- 无参数：实际执行模式（DRY_RUN = false）

## 📝 开发说明

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

### Q: 如何强制执行特定来源的脚本？

A: 通过交互模式选择数字即可，列表中会明确显示脚本分类。

### Q: --plan 参数有什么用？

A: 用于预演模式，脚本会输出将要执行的操作但不实际执行，适合：

- 查看脚本将做什么
- 验证参数是否正确
- 避免误操作

## 📊 技术实现

- **脚本扫描**：使用 `Bun.Glob` 扫描目录
- **脚本执行**：使用 `Bun.spawn` 执行子进程
- **交互输入**：使用 Node.js `readline` 模块
- **优先级处理**：在 `resolveScriptPath()` 中实现

---

**最后更新**: 2025-10-18
