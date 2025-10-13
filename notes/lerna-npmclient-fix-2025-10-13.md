# Lerna npmClient 配置问题修复

## 问题描述

执行 `lerna publish from-package --no-git-tag-version` 时报错：

```
error: bun is not installed in %PATH%

Error [ValidationError]: command failed
  cmd: 'C:\\WINDOWS\\system32\\cmd.exe'
  stderr: 'error: bun is not installed in %PATH%'
```

## 问题原因

1. **lerna.json 中配置了 `"npmClient": "bun"`**
2. Lerna 在执行 publish 生命周期钩子时，会在子进程中调用配置的 npmClient
3. 子进程使用的是 `cmd.exe`，而 cmd.exe 的 PATH 环境变量中没有 bun
4. 虽然 PowerShell 中可以运行 `bun -v`，但 cmd.exe 环境下找不到 bun 命令

## 环境差异

-   **PowerShell**: 有 bun 的 PATH 配置 ✅
-   **cmd.exe**: 没有 bun 的 PATH 配置 ❌
-   **Lerna 子进程**: 使用 cmd.exe 执行命令

## 解决方案

将 `lerna.json` 中的 `npmClient` 从 `bun` 改为 `npm`：

```json
{
    "npmClient": "npm", // 改为 npm
    "useWorkspaces": true
}
```

### 为什么改为 npm？

1. **发布不依赖包管理器**：我们只用 Lerna 做版本管理和发布，不需要它安装依赖
2. **npm 是系统内置的**：Windows 安装 Node.js 后，npm 在所有 shell 环境都可用
3. **Bun workspaces 继续工作**：package.json 中的 workspaces 配置由 Bun 原生支持
4. **不影响开发流程**：日常开发继续使用 `bun install`、`bun run` 等命令

## 验证修复

```bash
# 测试发布命令（dry-run 模式）
bunx lerna publish from-package --no-git-tag-version --dry-run

# 输出（成功）：
# lerna-lite notice cli v4.9.0
# lerna-lite success No changed packages to publish
```

## 最终配置

### lerna.json

```json
{
    "$schema": "node_modules/@lerna-lite/cli/schemas/lerna-schema.json",
    "version": "independent",
    "npmClient": "npm", // ✅ 使用 npm
    "useWorkspaces": true,
    "command": {
        "publish": {
            "registry": "https://registry.npmjs.org"
        }
    }
}
```

### 分工明确

-   **Bun**: 用于日常开发（安装依赖、运行脚本、测试）
-   **npm**: 用于发布包（Lerna 调用）
-   **Lerna**: 用于版本管理和发布协调

## 注意事项

1. 确保系统安装了 Node.js 和 npm
2. npm 版本建议 >= 8.0.0
3. 发布前需要登录 npm：`npm login`
4. 继续使用 bun 进行日常开发

---

**修复日期**: 2025-10-13
**状态**: ✅ 已解决
