# 数据库操作（ctx.db）

本页只描述对外可用的数据库 API（`befly.types/database`）与常用约定。

## 连接与方言

数据库连接由配置 `db` 决定（见 `config.md`）：

-   `db.dialect`: `mysql | postgresql | sqlite`

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

-   `getOne`：查询一条
-   `getDetail`：查询详情（语义别名，与 `getOne` 完全一致）
-   `getList`：分页查询（返回 `{ lists, total, page, limit, pages }`）
-   `getAll`：不分页查询（返回 `{ lists, total }`）
-   `getCount`：计数
-   `exists`：是否存在
-   `getFieldValue`：取单字段值

#### getOne / getDetail 的“未命中”语义（非常重要）

当前实现中：

-   `getOne/getDetail` **不会** 用 `null` 表示未命中
-   当未命中（或反序列化失败）时，会返回：`{ data: {}, sql }`

因此业务侧应通过关键字段判断是否存在，例如：

-   `if (typeof res.data.id !== "number") { /* 未命中 */ }`

如果你更喜欢“布尔语义”，请使用 `exists()`。

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

补充说明：

-   排除字段（`!`）模式需要先读取“表的全部列名”，该结果会写入 Redis 缓存（TTL=3600 秒）。
-   如果表不存在或没有字段，会直接抛错（属于“输入非法/结构异常”，不是静默返回）。

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

## 默认 state 过滤（隐式注入）

几乎所有查询类方法（`getOne/getDetail/getList/getAll/getCount/exists`）都会在 where 中 **默认注入**：

-   单表：`state$gt = 0`
-   JOIN：`<主表限定符>.state$gt = 0`

其中“主表限定符”规则：

-   如果主表写成 `order o`，限定符是 `o`
-   如果主表没有 alias，限定符是 snakeCase 后的表名

当你 **显式提供** 任何 `state...` 或 `*.state...` 条件时，框架不会再注入默认 state 条件（以你的条件为准）。

示例：

-   `where: { userId: 1 }` → 实际会变成 `where: { userId: 1, state$gt: 0 }`
-   `where: { state: 0 }` → 不注入（你已经写了 state 条件）
-   JOIN：`table: "order o"` 且 `where: { "o.userId": 1 }` → 会注入 `o.state$gt: 0`

> 这个默认策略与“逻辑删除/禁用”模型强绑定：state<=0 的数据默认对业务不可见。

### 如何查询 state<=0（已删除/禁用）或“包含全部 state”

做法只有一个：**在 where 里显式写出你要的 state 条件**（这样就不会触发默认注入）。

常见写法：

-   查询已删除（示例：`state = 0`）：`where: { state: 0 }`
-   查询禁用/其他状态：`where: { state: 2 }`
-   同时包含启用 + 禁用：`where: { state$gte: 1 }`（或用 `$in`）
-   包含全部（含 `state = 0`）：`where: { state$gte: 0 }`
-   包含全部（含 `state = -1` 的历史数据）：`where: { state$gte: -1 }`

JOIN 场景同理（把 `state` 条件写到主表或明确的别名上）：

-   `where: { "o.state$gte": 0 }`（包含 state=0）
-   `where: { "o.state": 0 }`（只查 state=0）

> 判定“是否显式提供 state 条件”的规则是：where 的 key 只要以 `state` 开头，或包含 `.state`（例如 `o.state$gte`），就视为你已指定。

## 表结构同步（syncTable）与类型映射

### 从 table.json 到真实表结构

`syncTable` 会把 `tables/*.json` 中的 FieldDefinition 同步为数据库列：

-   列名：`snakeCase(fieldKey)`
-   注释：MySQL 会写入 `COMMENT`；PostgreSQL 会写入 `COMMENT ON COLUMN`；SQLite 不支持列注释

### 字段类型映射（按 dialect）

下表为核心映射（简化展示，具体以运行时为准）：

-   `number`：MySQL/PG → `BIGINT`；SQLite → `INTEGER`
-   `string` / `array_string` / `array_number_string`：
    -   MySQL → `VARCHAR(max)`
    -   PostgreSQL → `character varying(max)`
    -   SQLite → `TEXT`（无长度约束）
-   `text` / `array_text` / `array_number_text`：MySQL → `MEDIUMTEXT`；其他 → `TEXT`

数组类型在 DB 中以 **JSON 字符串** 存储，读写由 `DbUtils` 负责序列化/反序列化。

### 默认值策略

-   `number`：未显式提供或为 null 时，默认值会被归一化为 `0`
-   `string`：默认值会被归一化为 `""`
-   `array_*`：默认值会被归一化为字符串 `"[]"`
-   `text/array_text/array_number_text`：默认值为 `null`（并且通常不会生成 SQL DEFAULT 子句）

### index / unique 的落地

-   `unique: true`：通过列级 `UNIQUE` 约束表达（数据库通常会隐式创建索引）
-   `index: true`：会创建单列索引 `idx_<column>`（当 `unique !== true` 时）
-   系统字段会自动补齐并创建系统索引（例如 `idx_pid`、`idx_sort` 等）

### 自动同步的安全阈值

为避免“自动迁移导致数据丢失”，syncTable 对变更有强约束：

-   **长度收缩**（例如 `VARCHAR(500) -> VARCHAR(200)`）会被跳过并告警（需要你手动处理）
-   **类型变更**只允许“宽化型变更”（例如 `INT -> BIGINT`、`VARCHAR -> TEXT`）；其他类型变更会直接抛错阻断

这意味着：你可以放心让它做“可逆/安全的扩展”，但不能依赖它做破坏性迁移。
