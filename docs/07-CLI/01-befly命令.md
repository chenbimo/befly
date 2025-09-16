# befly 命令行

Befly 在模板项目中通过 `bunx befly` 调用核心脚本（位于 `core/scripts`）。

## 查看可用脚本

在 `tpl/` 目录执行：

```
bunx befly
```

无参数时会打印所有可用脚本名称。

## 运行数据库同步

-   直接执行：

```
bunx befly syncDb
```

-   仅打印计划（Dry-run）：

```
bunx befly syncDb --plan
```

-   开发同步（示例）：

```
bunx befly syncDev --plan
```

说明：参数会原样透传给目标脚本。

## 环境要求

-   优先使用 Bun 运行；若缺失会回退到 Node（内部已处理）。
-   同步脚本期望 MySQL ≥ 8 / PostgreSQL ≥ 17 / SQLite ≥ 3.50（详见数据库章节）。

## 示例

-   仅预览变更计划：

```
cd tpl
bunx befly syncDb --plan
```

-   实际执行同步（请先备份）：

```
cd tpl
bunx befly syncDb
```

-   传参示例（将参数透传给目标脚本）：

```
cd tpl
bunx befly syncDb --plan --verbose
```
