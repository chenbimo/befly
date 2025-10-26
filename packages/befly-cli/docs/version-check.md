# Befly CLI 版本检查功能说明

## 功能概述

Befly CLI 在启动时会自动检查 Bun 运行时的版本，确保满足最低要求（>=1.3.0）。

## 检查流程

1. **检测 Bun 是否安装**
    - 使用 `Bun.version` API 获取当前版本
    - 如果获取失败，执行 `bun --version` 命令作为备用方案

2. **版本比较**
    - 解析版本号（主版本.次版本.修订号）
    - 与最低要求版本（1.3.0）进行比较

3. **错误提示**
    - 未安装 Bun：显示安装指南（Windows/macOS/Linux）
    - 版本过低：提示使用 `bun upgrade` 升级

## 使用示例

### 正常情况（Bun >= 1.3.0）

```bash
$ befly --help
Usage: befly [options] [command]

Befly CLI - 为 Befly 框架提供命令行工具
...
```

CLI 正常启动，版本检查静默通过。

### 未安装 Bun

```bash
$ befly init my-app
✖ 未检测到 Bun 运行时

Befly CLI 需要 Bun v1.3.0 或更高版本
请访问 https://bun.sh 安装 Bun

安装命令:
  Windows (PowerShell): powershell -c "irm bun.sh/install.ps1 | iex"
  macOS/Linux: curl -fsSL https://bun.sh/install | bash
```

### Bun 版本过低（如 1.2.9）

```bash
$ befly dev
✖ Bun 版本过低: 1.2.9

需要 Bun v1.3.0 或更高版本
请升级 Bun:

  bun upgrade
```

## 技术实现

### 版本检查函数

位置：`lib/utils/checkBun.ts`

```typescript
export function checkBunVersion(): void {
    const currentVersion = getBunVersion();

    if (!currentVersion) {
        // 未安装提示
        process.exit(1);
    }

    if (compareVersions(currentVersion, '1.3.0') < 0) {
        // 版本过低提示
        process.exit(1);
    }

    // 版本满足要求，静默通过
}
```

### 集成位置

在 CLI 入口文件（`bin/index.ts`）的最顶部调用：

```typescript
#!/usr/bin/env bun
import { checkBunVersion } from '../lib/utils/checkBun.js';

// 检查 Bun 版本（在任何其他导入之前）
checkBunVersion();

import { Command } from 'commander';
// ... 其他导入
```

## 测试覆盖

测试文件：`tests/checkBun.test.ts`

- ✓ Bun.version 存在性和格式验证
- ✓ 版本号满足最低要求（>=1.3.0）
- ✓ 版本比较逻辑正确性（各种场景）

## 维护说明

如需更新最低 Bun 版本要求：

1. 修改 `lib/utils/checkBun.ts` 中的 `REQUIRED_BUN_VERSION` 常量
2. 更新 `package.json` 中的 `engines.bun` 字段
3. 更新 `README.md` 中的系统要求说明
4. 更新测试用例中的版本预期值
