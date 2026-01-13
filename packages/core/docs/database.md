# 数据库操作（ctx.db）

本页只描述对外可用的数据库 API（`befly.types/database`）与常用约定。

## 连接与方言

数据库连接由配置 `db` 决定（见 `config.md`）：

-   `db.dialect`: `mysql | postgresql | sqlite | postgres`
    -   `postgres` 会归一化为 `postgresql`

运行时通过 `ctx.db` 提供数据库能力。

## 返回结构（DbResult）

几乎所有方法返回：

-   `{ data, sql }`

其中 `sql` 会包含：

-   `sql: string`
-   `params: SqlValue[]`
-   `duration: number`（毫秒）

## 常用 CRUD（按频率排序）

### 查询

-   `getOne`：查询一条（可能为 `null/undefined`，取决于具体实现；建议用 `getDetail` 表达“必须存在”语义）
-   `getDetail`：查询详情
-   `getList`：分页查询（返回 `{ lists, total, page, limit, pages }`）
-   `getAll`：不分页查询（返回 `{ lists, total }`）
-   `getCount`：计数
-   `exists`：是否存在
-   `getFieldValue`：取单字段值

### 写入

-   `insData` / `insBatch`
-   `updData` / `updBatch`
-   `delData`（逻辑删除）
-   `delForce` / `delForceBatch`（物理删除）
-   `enableData` / `disableData`（通过 state 控制）

### 事务

-   `trans(async (db) => { ... })`

> 事务回调拿到的是“事务内的 db”，请不要在回调里混用外部 db。

## 字段命名转换（camelCase ↔ snake_case）

对外使用建议：

-   表名：可以用小驼峰或下划线，框架会做 `snake_case` 归一化
-   字段名：建议在代码侧使用小驼峰，在 SQL 层会转换为下划线

示例：

```ts
// 写入：userId -> user_id
await ctx.db.insData({
    table: "user",
    data: {
        userId: 123,
        nickname: "Tom",
    },
});

// 查询：where 的 key 会转 snake_case
const res = await ctx.db.getDetail({
    table: "user",
    where: { userId: 123 },
});
```

## where 操作符（约定）

where 支持：

-   普通等值：`{ userId: 1 }`
-   带操作符：`{ userId$gt: 1, state$gt: 0 }`
-   逻辑组合：`{ $or: [ ... ], $and: [ ... ] }`

JOIN 场景下支持：

-   `"alias.field"` 或 `"table.field"`（点号前缀不会被 snakeCase 改写）
-   带操作符：`"o.userId$gt"`

## fields 字段选择（包含/排除）

`fields` 支持三种模式（不能混用）：

1. 不传或 `[]`：查询所有字段
2. 全部是普通字段：`["id", "nickname"]`
3. 全部是排除字段（`!` 开头）：`["!password", "!token"]`

注意：

-   不支持 `"*"` 星号（会报错）
-   排除字段模式会先读取表的全部列名（有缓存），然后做差集

## orderBy 排序

`orderBy` 使用 `"field#asc" | "field#desc"` 形式的字符串数组，例如：

-   `["id#desc"]`
-   `["createdAt#desc", "id#desc"]`

字段名会转 snake_case。

## JOIN 查询

当 `joins` 存在时：

-   主表支持 `table alias` 或 `schema.table alias`
-   字段 `fields` 支持 `alias.field`、`alias.field AS x`
-   where key 支持 `alias.field$op`

（JOIN 的具体 SQL 由框架生成；你只需要遵循上述输入约定。）
