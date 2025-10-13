# Befly Monorepo 发版配置说明

## 核心依赖（最精简）

```json
{
    "devDependencies": {
        "@lerna-lite/cli": "4.9.0", // Lerna 核心 CLI
        "@lerna-lite/publish": "4.9.0", // npm 发布功能
        "@lerna-lite/version": "4.9.0" // 版本管理
    }
}
```

## 为什么这样精简？

1. **Bun Workspaces**: Bun 原生支持 monorepo，无需额外工具
2. **只需发版**: 只保留版本管理和发布相关的包
3. **纯粹发布**: 不生成 CHANGELOG，不创建 git tag

## 发版流程

### 方式一：使用发布脚本（推荐）

```bash
# 一键发布（交互式指定版本）
bun run temp/publish.js
```

特点：

-   ✅ 只发布有改动的包
-   ✅ 手动指定每个包的版本号
-   ✅ 不生成 CHANGELOG
-   ✅ 不创建 git tag
-   ✅ 不推送到 git

### 方式二：手动分步执行

```bash
# 1. 手动更新版本号
bun run version

# 2. 发布到 npm
bun run publish
```

### 方式三：CI/CD 自动发布

```bash
bun run publish:ci
```

## publish.js 脚本功能

纯粹 npm 发布流程：

1. 🧪 运行测试
2. 📝 手动指定版本号（交互式）
3. 📤 发布到 npm（Lerna 自动检测有改动的包）

## 常用命令

```bash
# 查看所有包
bun run list

# 查看哪些包有变更
bun run changed

# 本地开发
bun run dev

# 运行测试
bun run test
```

## 配置文件说明

-   `lerna.json` - Lerna 发版配置
-   `package.json` - 根工作区配置
-   `.npmrc` - npm 注册表配置
-   `release.js` - 自动化发版脚本

## 注意事项

1. 使用 `independent` 版本模式，每个包独立版本
2. 遵循 Conventional Commits 规范自动生成 CHANGELOG
3. tpl 包通过 `workspace:*` 引用本地 core 包
4. 发布时会自动忽略 `.md`、`.test.ts` 等文件的变更
