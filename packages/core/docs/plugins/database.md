# Befly 数据库（DbHelper）

本文档只描述 **当前实现**：所有数据库操作统一返回 `DbResult`（`{ data, sql }`），调用方必须读取 `.data`。

## 核心约定：DbResult（必须读 data）

`DbHelper` 的所有方法都会返回：

- `data`：你真正要用的结果
- `sql`：本次执行的 SQL 信息（用于调试/排错）

```js
type DbResult<TData = any, TSql = SqlInfo> = {
data: TData;
sql: TSql;
};

```

### SQL 信息（SqlInfo / ListSql）

- 单条/写入类操作的 `sql` 为 `SqlInfo`：
    - `sql`：SQL 字符串
    - `params`：参数数组
    - `duration`：耗时（毫秒）
- 列表/全量查询的 `sql` 为 `ListSql`：
    - `count`：统计 SQL（用于 total）
    - `data?`：数据 SQL（当 total=0 时可能不会执行第二次查询）

> 注意：不要把整个 `DbResult` 直接返回给客户端；应只返回 `result.data`。

## 常用查询

### getOne（单条）

```typescript
const userRes = await befly.db.getOne({
    table: "user",
    fields: ["id", "email", "nickname"],
    where: { id: ctx.user?.id }
});

const user = userRes.data;
if (!user?.id) {
    return befly.tool.No("用户不存在");
}

return befly.tool.Yes("获取成功", user);
```

### getList（分页）

```typescript
const listRes = await befly.db.getList({
    table: "user",
    fields: ["id", "email", "nickname"],
    where: { state: 1 },
    page: 1,
    limit: 20,
    orderBy: ["id#DESC"]
});

return befly.tool.Yes("获取成功", listRes.data);
// listRes.data: { lists, total, page, limit, pages }
```

### getAll（不分页，有上限保护）

```typescript
const allRes = await befly.db.getAll({
    table: "user",
    fields: ["id", "email"],
    where: { state: 1 },
    orderBy: ["createdAt#DESC"]
});

return befly.tool.Yes("获取成功", allRes.data);
// allRes.data: { lists, total }
```

## 写入与返回值

### insData（插入单条）

`insData` 返回插入的 ID（数值）：

```typescript
const idRes = await befly.db.insData({
    table: "user",
    data: {
        email: ctx.body.email,
        nickname: ctx.body.nickname
    }
});

return befly.tool.Yes("创建成功", { id: idRes.data });
```

### updData / delData

`updData` / `delData` 返回影响行数（数值）：

```typescript
const updRes = await befly.db.updData({
    table: "user",
    data: { nickname: ctx.body.nickname },
    where: { id: ctx.user?.id }
});

return befly.tool.Yes("更新成功", { changed: updRes.data });
```

### insBatch（批量插入）

`insBatch` 返回插入的 ID 列表：

```typescript
const idsRes = await befly.db.insBatch("user", [
    { email: "a@qq.com", nickname: "A" },
    { email: "b@qq.com", nickname: "B" }
]);

return befly.tool.Yes("导入成功", { ids: idsRes.data });
```

## 字段/排序

### fields（字段选择）

- 不传或 `[]`：查询所有字段
- 仅包含字段：`["id", "email"]`
- 仅排除字段：`["!password"]`

> 禁止混用包含与排除。

### orderBy（排序）

格式：`"字段#ASC" | "字段#DESC"`，例如：`["id#DESC"]`。

## null/undefined 自动过滤

DbHelper 在写入（`insData/insBatch/updData`）以及查询条件（`where`）中，会自动过滤 `null/undefined`。

如果你希望在业务侧更精细控制（例如：保留 `0` / 空字符串），请使用 `fieldClear`：

```typescript
import { fieldClear } from "befly/utils/fieldClear";

const data = fieldClear(
    { nickname: ctx.body.nickname, sort: ctx.body.sort, state: ctx.body.state },
    { excludeValues: [null, undefined], keepMap: { sort: 0, state: 0 } }
);
```

## 事务（trans）

````typescript
const out = await befly.db.trans(async (trx) => {
    const idRes = await trx.insData({
        table: "order",
        data: { userId: ctx.user?.id, status: "pending" }
    });
    return { orderId: idRes.data };
});

return befly.tool.Yes("创建成功", out);

## 原生 SQL（query / unsafe）

```typescript
const r = await befly.db.query("SELECT 1 AS cnt");
return befly.tool.Yes("ok", r.data);
````

`unsafe` 用于内部脚本/同步逻辑（行为与 `query` 相同，返回 `DbResult`）。

## 错误定位：error.sqlInfo

当 SQL 执行失败，抛出的错误对象会带 `sqlInfo`：

```typescript
try {
    await befly.db.query("SELECT * FROM not_exists");
} catch (error: any) {
    // error.sqlInfo: { sql, params, duration }
    befly.logger.error({ sqlInfo: error?.sqlInfo }, "SQL 执行失败");
    throw error;
}
```
