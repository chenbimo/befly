# 同步脚本：syncDb 与 syncDev

Befly 提供表结构同步脚本，读取 `core/tables/*.json` 与 `<project>/tables/*.json` 生成 DDL 并应用到数据库。

## 快速使用

在 `tpl/` 目录：

```
bunx befly syncDb --plan
```

-   `--plan` 仅打印计划，不执行变更。
-   去掉 `--plan` 则会实际执行。

## 规则来源与校验

-   核心：`core/tables/*.json`
-   项目：`<project>/tables/*.json`
-   运行前会先调用 `checks/table.js` 做严格校验（段数/类型/长度/默认值/命名/保留字段等）。

## 执行策略与限制（节选）

-   每表合并 ALTER，失败回退。
-   MySQL 使用 INPLACE + LOCK=NONE 尽量在线；PG 使用 CONCURRENTLY 处理索引。
-   SQLite 不支持改默认值与多数列变更；必要时启用“重建”策略（后续章节详述）。

详细策略与输出示例请参考：`core/docs/syncDb.md`、`core/docs/table.md`。

## 示例

-   新增一张表定义（`tpl/tables/userProfile.json`）：

```json
{
    "nickname": "昵称 ⚡string⚡1⚡32⚡null⚡1⚡^[a-zA-Z0-9_]+$",
    "age": "年龄 ⚡number⚡0⚡150⚡0⚡0⚡null"
}
```

-   预览与执行：

```
cd tpl
bunx befly syncDb --plan
bunx befly syncDb
```
