# Befly Monorepo 工作区配置

## 目录结构

```
befly/
├── packages/
│   ├── core/          # befly 核心框架包
│   └── tpl/           # befly 模板项目包
├── docs/              # 文档目录
├── notes/             # 开发记录
├── lerna.json         # Lerna 配置
├── package.json       # 根包配置
└── .npmrc             # npm 配置
```

## 包管理

### 安装依赖

```bash
# 安装所有工作区依赖
bun install

# 为特定包安装依赖
bun install --cwd packages/core <package-name>
bun install --cwd packages/tpl <package-name>
```

### 链接工作区包

Bun 原生支持 workspaces，tpl 包中的 `befly: "workspace:*"` 会自动链接到 core 包。

## 开发流程

### 本地开发

```bash
# 启动 tpl 开发服务器
bun run dev

# 在 core 包中运行命令
bun --cwd packages/core <command>

# 在 tpl 包中运行命令
bun --cwd packages/tpl <command>
```

### 测试

```bash
# 运行 tpl 包测试
bun run test

# 运行所有包测试
bun run test:all
```

## 版本发布

### 纯粹 npm 发布（推荐）

```bash
# 一键发布流程（交互式指定版本）
bun run temp/publish.js
```

发布特点：

-   ✅ 只发布有代码改动的包
-   ✅ 手动指定每个包的版本号
-   ✅ 不生成 CHANGELOG
-   ✅ 不创建 git tag
-   ✅ 不推送到 git
-   ✅ 纯粹的 npm 包发布

### 分步发布流程

```bash
# 1. 手动更新版本号
bun run version

# 2. 发布到 npm
bun run publish
```

### CI/CD 自动发布

```bash
# 自动确认发布（用于 CI，跳过交互）
bun run publish:ci
```

### 版本策略

-   **Independent Mode**: 每个包独立版本管理
-   **Manual Versioning**: 手动指定版本号
-   **Changed Only**: 只发布有改动的包
-   **No Git Operations**: 不操作 git（无 tag、无 commit、无 push）
-   **Workspace Protocol**: tpl 使用 `workspace:*` 引用 core

## Lerna 核心命令

```bash
# 更新版本
bun run version

# 发布包
bun run publish
```

## 依赖说明

monorepo 只安装了发版必需的依赖：

-   `@lerna-lite/cli` - Lerna 核心 CLI
-   `@lerna-lite/publish` - npm 发布功能
-   `@lerna-lite/version` - 版本管理和 CHANGELOG 生成

其他功能通过 Bun 原生 workspaces 支持。

## 注意事项

1. **包版本**: 使用 independent 模式，core 和 tpl 可以有不同版本
2. **依赖管理**: tpl 通过 `workspace:*` 始终使用本地 core 包
3. **发布前检查**: 自动运行测试和工作区检查
4. **Conventional Commits**: 遵循约定式提交规范自动生成版本和 CHANGELOG
