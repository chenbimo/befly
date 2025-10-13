# Befly 项目文件组织规范

## 目录规范

### `/notes` 目录

存放所有说明、记录、总结类文档：

-   工作区说明文档（WORKSPACE.md）
-   发布说明文档（PUBLISH.md）
-   重构总结文档
-   问题排查记录
-   功能规划文档
-   优化记录文档
-   等所有 markdown 格式的记录文档

### `/temp` 目录

存放所有临时执行文件：

-   临时测试脚本
-   一次性执行脚本
-   临时调试文件
-   发布脚本（publish.js）
-   等所有临时性质的可执行文件

## 文件移动记录

### 2025-10-13 调整

**移动到 notes 目录：**

-   `WORKSPACE.md` → `notes/WORKSPACE.md`
-   `PUBLISH.md` → `notes/PUBLISH.md`

**移动到 temp 目录：**

-   `publish.js` → `temp/publish.js`

## 使用说明

### 执行 temp 目录下的脚本

```bash
# 发布脚本
bun run temp/publish.js
```

### 查看 notes 目录下的文档

```bash
# 查看工作区说明
cat notes/WORKSPACE.md

# 查看发布说明
cat notes/PUBLISH.md
```

## 规范要求

1. **所有新增的说明文档**必须放到 `notes/` 目录
2. **所有临时执行脚本**必须放到 `temp/` 目录
3. 保持根目录简洁，只保留核心配置文件
4. 文档命名使用小写加连字符，如：`feature-plan.md`
5. 脚本命名使用小驼峰，如：`publishScript.js`

---

**更新日期**: 2025-10-13
**规范版本**: v1.0
