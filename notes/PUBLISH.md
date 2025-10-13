# Befly Monorepo 纯粹 npm 发布指南

## 🎯 发布特点

-   ✅ **只发布有改动的包** - 自动检测代码变更
-   ✅ **手动指定版本号** - 每个包独立版本管理
-   ✅ **不生成 CHANGELOG** - 保持简洁
-   ✅ **不创建 git tag** - 不污染 git 历史
-   ✅ **不推送到 git** - 手动控制提交时机
-   ✅ **纯粹 npm 发布** - 专注于包发布

## 🚀 快速发布

```bash
# 一键发布（推荐）
bun run temp/publish.js
```

这个命令会：

1. 检查有改动的包
2. 运行测试
3. 交互式指定版本号
4. 发布到 npm

## 📋 分步发布

```bash
# 1. 更新版本号（交互式）
bun run version

# 2. 发布到 npm
bun run publish
```

## 🔧 命令说明

| 命令                      | 说明                 |
| ------------------------- | -------------------- |
| `bun run temp/publish.js` | 完整发布流程（推荐） |
| `bun run version`         | 手动更新版本号       |
| `bun run publish`         | 发布到 npm           |
| `bun run publish:ci`      | CI 自动发布          |

## 📦 发布示例

### 交互式发布

```bash
$ bun run temp/publish.js

💡 提示：Lerna 会自动检测有改动的包

🧪 运行测试...
✓ 测试通过

📝 请为每个改动的包指定版本号...
? Select a new version for befly (currently 3.0.0)
  ❯ Patch (3.0.1)
    Minor (3.1.0)
    Major (4.0.0)
    Custom Version

? Select a new version for befly-template (currently 3.0.0)
  ❯ Patch (3.0.1)

📤 发布到 npm...
✓ befly@3.0.1 发布成功
✓ befly-template@3.0.1 发布成功

✅ 发布完成！
```

### 手动指定版本

```bash
# 指定具体版本号
$ bun run version
? Select a new version (currently 3.0.0) Custom Version
? Enter a custom version 3.1.0

# 发布
$ bun run publish
```

## 🔒 CI/CD 自动发布

```bash
# 跳过交互，自动确认
bun run publish:ci
```

## ⚙️ 配置文件

### lerna.json

```json
{
    "version": "independent",
    "command": {
        "publish": {
            "gitTagVersion": false, // 不创建 git tag
            "push": false // 不推送到 git
        },
        "version": {
            "conventionalCommits": false, // 不生成 CHANGELOG
            "gitTagVersion": false // 不创建 git tag
        }
    }
}
```

### package.json 脚本

```json
{
    "scripts": {
        "version": "lerna version --no-push --no-git-tag-version",
        "publish": "lerna publish from-package --no-git-tag-version"
    }
}
```

## 📝 发布后操作

发布完成后，你需要手动：

```bash
# 1. 提交版本变更
git add .
git commit -m "chore: bump versions"

# 2. 推送到远程（可选）
git push
```

## 🤔 常见问题

### Q: 为什么不自动创建 git tag？

A: 为了让你手动控制版本管理，避免污染 git 历史。

### Q: 如何只发布某个包？

A: Lerna 会自动检测改动，只发布有变更的包。

### Q: 版本号规则是什么？

A: 每个包独立版本，可以不同步。

### Q: 如何回退发布？

A: 使用 `npm unpublish` 或发布新版本覆盖。

## 📚 更多信息

查看完整文档：`WORKSPACE.md`
