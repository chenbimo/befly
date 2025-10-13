# Befly 文件组织总结

## ✅ 已完成的调整（2025-10-13）

### 1. AGENTS.md 指令更新

已在 `AGENTS.md` 中添加文件组织规范：

```markdown
-   所有临时的测试脚本、文件等，都放到根目录下的 `temp` 目录下
-   所有说明文档、记录文档、总结文档等，都放到根目录下的 `notes` 目录下
```

### 2. 文件重新组织

**移动到 `notes/` 目录的文档：**

-   `WORKSPACE.md` → `notes/WORKSPACE.md` （工作区说明）
-   `PUBLISH.md` → `notes/PUBLISH.md` （发布指南）
-   所有历史记录文档（已在 notes 目录）

**移动到 `temp/` 目录的脚本：**

-   `publish.js` → `temp/publish.js` （发布脚本）

### 3. 更新相关引用

已更新以下文件中的路径引用：

-   `notes/WORKSPACE.md` - 发布脚本路径
-   `notes/PUBLISH.md` - 发布脚本路径和示例
-   `notes/monorepo-publish-config.md` - 脚本引用
-   `notes/monorepo-final-config-2025-10-13.md` - 文档路径

### 4. 项目结构说明

在 `README.md` 中添加了完整的项目结构说明。

### 5. Git 配置

更新 `.gitignore`：

-   `temp/*` - 忽略临时文件（保留目录结构）
-   `notes/` - 不忽略（所有文档都应提交）
-   移除了 `AGENTS.md` 的忽略（应该提交）

## 📁 最终目录结构

```
befly/
├── packages/              # Monorepo 工作区
│   ├── core/             # Befly 核心框架（npm 包）
│   └── tpl/              # 项目模板示例
├── docs/                 # 使用文档（教程）
├── notes/                # 说明记录文档 ✨
│   ├── WORKSPACE.md      # 工作区使用说明
│   ├── PUBLISH.md        # 发布指南
│   ├── file-organization.md  # 文件组织规范
│   └── *.md              # 所有开发记录文档
├── temp/                 # 临时执行脚本 ✨
│   ├── .gitkeep          # 保持目录结构
│   ├── publish.js        # 发布脚本
│   └── *.js/.ts          # 所有临时脚本
├── AGENTS.md             # AI Agent 指令
├── README.md             # 项目说明
├── lerna.json            # Lerna 配置
└── package.json          # 根包配置
```

## 📝 文件组织规范

### `notes/` 目录规范

**适用文件类型：**

-   工作区说明（WORKSPACE.md）
-   发布指南（PUBLISH.md）
-   架构分析文档
-   重构总结文档
-   问题排查记录
-   功能规划文档
-   优化记录文档
-   所有 `.md` 格式的记录文档

**命名规范：**

-   使用小写加连字符：`feature-plan.md`
-   添加日期后缀：`refactor-summary-2025-10-13.md`
-   描述性文件名：`api-route-simplification.md`

### `temp/` 目录规范

**适用文件类型：**

-   临时测试脚本
-   一次性执行脚本
-   临时调试文件
-   发布脚本
-   所有 `.js`、`.ts` 临时文件

**命名规范：**

-   使用小驼峰：`publishScript.js`
-   描述性命名：`testDatabaseConnection.ts`
-   可以添加 `temp-` 前缀：`temp-debugScript.js`

**Git 策略：**

-   目录结构提交（通过 .gitkeep）
-   实际文件不提交（通过 .gitignore）

## 🚀 使用方式

### 执行 temp 目录脚本

```bash
# 发布脚本
bun run temp/publish.js

# 测试脚本
bun run temp/testScript.ts
```

### 查看 notes 目录文档

```bash
# 查看工作区说明
cat notes/WORKSPACE.md

# 查看发布指南
cat notes/PUBLISH.md

# 查看所有记录
ls notes/
```

## ✅ 检查清单

-   [x] 更新 AGENTS.md 指令
-   [x] 移动文档到 notes 目录
-   [x] 移动脚本到 temp 目录
-   [x] 更新所有文档中的路径引用
-   [x] 更新 README.md 项目结构
-   [x] 配置 .gitignore
-   [x] 创建 temp/.gitkeep
-   [x] 创建文件组织规范文档

---

**完成日期**: 2025-10-13
**状态**: ✅ 全部完成
