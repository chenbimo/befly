# Befly 数据库操作指南

> 本文档详细介绍 Befly 框架的数据库操作 API，包括 CRUD 操作、事务、条件查询等。

> 本文档已迁移到：[`./plugins/database.md`](./plugins/database.md)

## 目录

- [Befly 数据库操作指南](#befly-数据库操作指南)
  - [目录](#目录)
  - [核心概念](#核心概念)
    - [DbHelper](#dbhelper)
    - [自动转换](#自动转换)
    - [自动过滤 null 和 undefined](#自动过滤-null-和-undefined)
      - [写入时自动过滤](#写入时自动过滤)
      - [更新时自动过滤](#更新时自动过滤)
      - [Where 条件自动过滤](#where-条件自动过滤)
      - [实际应用示例](#实际应用示例)
      - [手动清理字段](#手动清理字段)
  - [字段命名规范](#字段命名规范)
  - [查询方法](#查询方法)
    - [getOne - 查询单条](#getone---查询单条)
    - [getList - 分页查询](#getlist---分页查询)
    - [getAll - 查询全部](#getall---查询全部)
    - [getCount - 查询数量](#getcount---查询数量)
    - [exists - 检查存在](#exists---检查存在)
    - [getFieldValue - 查询单字段](#getfieldvalue---查询单字段)
  - [写入方法](#写入方法)
    - [insData - 插入数据](#insdata---插入数据)
    - [insBatch - 批量插入](#insbatch---批量插入)
    - [updData - 更新数据](#upddata---更新数据)
    - [delData - 软删除](#deldata---软删除)
    - [delForce - 硬删除](#delforce---硬删除)
    - [disableData - 禁用](#disabledata---禁用)
    - [enableData - 启用](#enabledata---启用)
  - [数值操作](#数值操作)
    - [increment - 自增](#increment---自增)
    - [decrement - 自减](#decrement---自减)
  - [事务操作](#事务操作)
  - [多表联查](#多表联查)
    - [简洁写法（推荐）](#简洁写法推荐)
    - [JoinOption 参数说明](#joinoption-参数说明)
    - [联查注意事项](#联查注意事项)
    - [完整示例：订单列表 API](#完整示例订单列表-api)
    - [使用 query 原始 SQL](#使用-query-原始-sql)
  - [Where 条件语法](#where-条件语法)
    - [基础条件](#基础条件)
    - [比较操作符](#比较操作符)
    - [逻辑操作符](#逻辑操作符)
    - [范围操作符](#范围操作符)
    - [空值操作符](#空值操作符)
    - [模糊匹配](#模糊匹配)
  - [字段选择语法](#字段选择语法)
    - [查询所有字段](#查询所有字段)
    - [指定字段](#指定字段)
    - [排除字段](#排除字段)
  - [排序语法](#排序语法)
  - [系统字段说明](#系统字段说明)
    - [State 状态值](#state-状态值)
    - [默认 State 过滤](#默认-state-过滤)
  - [完整示例](#完整示例)
    - [用户管理 API](#用户管理-api)
    - [订单创建（事务）](#订单创建事务)
    - [复杂查询](#复杂查询)

---

## 核心概念

### DbHelper

`DbHelper` 是 Befly 的数据库操作核心类，提供了完整的 CRUD 封装。通过 `befly.db` 访问。

```typescript
// 在 API handler 中使用
handler: async (befly, ctx) => {
    const user = await befly.db.getOne({
        table: "user",
        where: { id: 1 }
    });
};
```

### 自动转换

- **表名**：小驼峰 `userProfile` 自动转换为下划线 `user_profile`
- **字段名**：写入时小驼峰转下划线，查询时下划线转小驼峰
- **BIGINT 字段**：`id`、`*Id`、`*_id`、`*At`、`*_at` 自动转为 number

### 自动过滤 null 和 undefined

所有写入方法（`insData`、`insBatch`、`updData`）和条件查询（`where`）都会**自动过滤值为 `null` 或 `undefined` 的字段**。

这意味着：

- 传入 `undefined` 或 `null` 的字段会被忽略，不会写入数据库
- `where` 条件中值为 `undefined` 或 `null` 的条件会被忽略
- 这使得处理可选参数变得非常简单，无需手动判断

#### 写入时自动过滤

```typescript
// 用户提交的数据可能部分字段为空
await befly.db.insData({
    table: "user",
    data: {
        username: "john",
        email: "john@example.com",
        phone: undefined, // ❌ 自动忽略，不会写入
        avatar: null, // ❌ 自动忽略，不会写入
        nickname: "" // ✅ 空字符串会写入（不是 null/undefined）
    }
});
// 实际 SQL: INSERT INTO user (username, email, nickname, ...) VALUES ('john', 'john@example.com', '', ...)
```

#### 更新时自动过滤

```typescript
// 只更新用户提交的字段
await befly.db.updData({
    table: "user",
    data: {
        nickname: ctx.body.nickname, // 如果用户传了值，会更新
        avatar: ctx.body.avatar, // 如果为 undefined，自动忽略
        bio: ctx.body.bio // 如果为 null，自动忽略
    },
    where: { id: ctx.user.id }
});
// 只有非 null/undefined 的字段会被更新
```

#### Where 条件自动过滤

```typescript
// 条件筛选：用户可能只传部分筛选条件
const result = await befly.db.getList({
    table: "article",
    where: {
        categoryId: ctx.body.categoryId, // 如果未传，值为 undefined，自动忽略
        status: ctx.body.status, // 如果未传，值为 undefined，自动忽略
        authorId: ctx.body.authorId // 如果未传，值为 undefined，自动忽略
    },
    page: 1,
    limit: 10
});
// 只有非 null/undefined 的条件会参与 WHERE 构建
```

#### 实际应用示例

```typescript
// API: 用户列表（带可选筛选条件）
export default {
    name: "用户列表",
    fields: {
        keyword: { name: "关键词", type: "string", max: 50 },
        status: { name: "状态", type: "number" },
        state: { name: "状态", type: "number" }
    },
    handler: async (befly, ctx) => {
        // 直接使用请求参数，无需判断是否存在
        // null/undefined 的条件会被自动过滤
        const result = await befly.db.getList({
            table: "user",
            where: {
                status: ctx.body.status, // 未传时为 undefined，自动忽略
                state: ctx.body.state, // 未传时为 undefined，自动忽略
                username$like: ctx.body.keyword ? `%${ctx.body.keyword}%` : undefined // 无关键词时忽略
            },
            page: ctx.body.page || 1,
            limit: ctx.body.limit || 10
        });

        return befly.tool.Yes("查询成功", result);
    }
};
```

#### 手动清理字段

如需手动清理数据，可以使用 `cleanFields` 方法：

```typescript
// 默认排除 null 和 undefined
const cleanData = befly.db.cleanFields({
    name: "John",
    age: null,
    email: undefined,
    phone: ""
});
// 结果: { name: 'John', phone: '' }

// 自定义排除值（如同时排除空字符串）
const cleanData2 = befly.db.cleanFields(
    { name: "John", phone: "", age: null },
    [null, undefined, ""] // 排除这些值
);
// 结果: { name: 'John' }

// 保留特定字段的特定值（即使在排除列表中）
const cleanData3 = befly.db.cleanFields(
    { name: "John", status: null, count: 0 },
    [null, undefined], // 排除 null 和 undefined
    { status: null } // 但保留 status 字段的 null 值
);
// 结果: { name: 'John', status: null, count: 0 }
```

---

## 字段命名规范

| 位置                  | 格式   | 示例                    |
| --------------------- | ------ | ----------------------- |
| 代码中（参数/返回值） | 小驼峰 | `userId`, `createdAt`   |
| 数据库中              | 下划线 | `user_id`, `created_at` |

```typescript
// 写入时使用小驼峰
await befly.db.insData({
    table: "user",
    data: {
        userName: "John", // → user_name
        createdBy: 1 // → created_by
    }
});

// 查询返回小驼峰
const user = await befly.db.getOne({
    table: "user",
    where: { userId: 1 } // → WHERE user_id = 1
});
// 返回: { userId: 1, userName: 'John', createdBy: 1 }
```

---

## 查询方法

### getOne - 查询单条

查询满足条件的第一条记录。

```typescript
interface QueryOptions {
    table: string; // 表名
    fields?: string[]; // 字段列表（可选）
    where?: WhereConditions; // 查询条件（可选）
}
```

**示例：**

```typescript
// 基础查询
const user = await befly.db.getOne({
    table: "user",
    where: { id: 1 }
});

// 指定字段
const user = await befly.db.getOne({
    table: "user",
    fields: ["id", "username", "email"],
    where: { id: 1 }
});

// 排除字段（使用 ! 前缀）
const user = await befly.db.getOne({
    table: "user",
    fields: ["!password", "!token"],
    where: { id: 1 }
});
```

### getList - 分页查询

分页查询，返回列表和分页信息。

```typescript
interface QueryOptions {
    table: string;
    fields?: string[];
    where?: WhereConditions;
    orderBy?: string[]; // 排序，格式: ["field#ASC", "field#DESC"]
    page?: number; // 页码，默认 1
    limit?: number; // 每页数量，默认 10
}

interface ListResult<T> {
    list: T[]; // 数据列表
    total: number; // 总记录数
    page: number; // 当前页码
    limit: number; // 每页数量
    pages: number; // 总页数
}
```

**示例：**

```typescript
// 基础分页
const result = await befly.db.getList({
    table: "user",
    page: 1,
    limit: 10
});
// 返回: { list: [...], total: 100, page: 1, limit: 10, pages: 10 }

// 带条件和排序
const result = await befly.db.getList({
    table: "user",
    fields: ["id", "username", "createdAt"],
    where: { state: 1 },
    orderBy: ["createdAt#DESC", "id#ASC"],
    page: 2,
    limit: 20
});
```

### getAll - 查询全部

查询所有满足条件的记录（有上限保护，最多 10000 条）。

**返回值**：`{ lists: T[], total: number }`

- `lists`：数据数组（受 MAX_LIMIT 保护，最多 10000 条）
- `total`：真实总记录数（不受 MAX_LIMIT 限制）

```typescript
// 查询所有
const result = await befly.db.getAll({
    table: "user"
});
// result: { lists: [...], total: 实际总数 }

// 带条件
const activeResult = await befly.db.getAll({
    table: "user",
    fields: ["id", "username"],
    where: { state: 1 },
    orderBy: ["sort#ASC"]
});

// 访问数据
console.log(activeResult.lists); // 数据数组（最多 10000 条）
console.log(activeResult.total); // 真实总数（如 100000）
```

**重要说明**：

- `total` 是查询满足条件的真实总记录数
- `lists` 受 `MAX_LIMIT = 10000` 保护，最多返回 10000 条
- 如果总数超过 10000，`lists.length < total`
- 建议使用 `getList` 进行分页查询

> ⚠️ **警告**：此方法可能返回大量数据。超过 1000 条会输出警告日志，达到 10000 条会提示只返回部分数据。

### getCount - 查询数量

仅查询满足条件的记录数量。

```typescript
// 查询总数
const count = await befly.db.getCount({
    table: "user"
});

// 条件计数
const activeCount = await befly.db.getCount({
    table: "user",
    where: { state: 1 }
});
```

### exists - 检查存在

检查是否存在满足条件的记录（性能优化版）。

```typescript
const hasAdmin = await befly.db.exists({
    table: "user",
    where: { roleCode: "admin" }
});

if (hasAdmin) {
    // 存在管理员
}
```

### getFieldValue - 查询单字段

查询单条记录的单个字段值。

```typescript
// 查询用户名
const username = await befly.db.getFieldValue({
    table: "user",
    field: "username",
    where: { id: 1 }
});

// 查询余额
const balance = await befly.db.getFieldValue<number>({
    table: "account",
    field: "balance",
    where: { userId: 1 }
});
```

---

## 写入方法

### insData - 插入数据

插入单条数据，自动生成系统字段。

```typescript
interface InsertOptions {
    table: string;
    data: Record<string, any>;
}
```

**自动生成的字段：**

| 字段         | 说明              |
| ------------ | ----------------- |
| `id`         | 基于时间的唯一 ID |
| `created_at` | 创建时间戳        |
| `updated_at` | 更新时间戳        |
| `state`      | 状态，默认 1      |

**示例：**

```typescript
// 插入用户
const userId = await befly.db.insData({
    table: "user",
    data: {
        username: "john",
        email: "john@example.com",
        password: hashedPassword,
        categoryId: 1
    }
});
// 返回新记录的 ID

// 系统字段不可覆盖
await befly.db.insData({
    table: "user",
    data: {
        id: 999, // ❌ 会被忽略，自动生成
        createdAt: 0, // ❌ 会被忽略，自动生成
        state: 2, // ❌ 会被忽略，强制设为 1
        username: "john" // ✅ 正常写入
    }
});
```

### insBatch - 批量插入

批量插入多条数据（最多 1000 条）。

```typescript
// 批量插入
const ids = await befly.db.insBatch("user", [
    { username: "user1", email: "user1@example.com" },
    { username: "user2", email: "user2@example.com" },
    { username: "user3", email: "user3@example.com" }
]);
// 返回: [id1, id2, id3]
```

### updData - 更新数据

更新满足条件的记录。

```typescript
interface UpdateOptions {
    table: string;
    data: Record<string, any>;
    where: WhereConditions;
}
```

**示例：**

```typescript
// 更新用户
const affected = await befly.db.updData({
    table: "user",
    data: {
        nickname: "新昵称",
        email: "new@example.com"
    },
    where: { id: 1 }
});
// 返回受影响的行数

// 批量更新
await befly.db.updData({
    table: "user",
    data: { state: 2 },
    where: { status: 5 }
});
```

**注意事项：**

- `updated_at` 自动更新为当前时间
- `id`、`created_at`、`deleted_at` 不可修改
- `state` 允许修改（用于禁用/启用）

### delData - 软删除

软删除记录（设置 `state=0` 和 `deleted_at`）。

```typescript
// 软删除
const affected = await befly.db.delData({
    table: "user",
    where: { id: 1 }
});
```

### delForce - 硬删除

物理删除记录（不可恢复）。

```typescript
// 硬删除
const affected = await befly.db.delForce({
    table: "temp_data",
    where: { expiredAt$lt: Date.now() }
});
```

> ⚠️ **警告**：硬删除不可恢复，请谨慎使用。

### disableData - 禁用

禁用记录（设置 `state=2`）。

```typescript
// 禁用用户
await befly.db.disableData({
    table: "user",
    where: { id: 1 }
});
```

### enableData - 启用

启用记录（设置 `state=1`）。

```typescript
// 启用用户
await befly.db.enableData({
    table: "user",
    where: { id: 1 }
});
```

---

## 数值操作

### increment - 自增

对数值字段进行自增操作。

```typescript
// 阅读数 +1
await befly.db.increment("article", "viewCount", { id: 1 });

// 阅读数 +10
await befly.db.increment("article", "viewCount", { id: 1 }, 10);
```

### decrement - 自减

对数值字段进行自减操作。

```typescript
// 库存 -1
await befly.db.decrement("product", "stock", { id: 1 });

// 余额 -100
await befly.db.decrement("account", "balance", { userId: 1 }, 100);
```

---

## 事务操作

使用 `trans` 方法执行事务，自动处理 commit/rollback。

```typescript
// 转账示例
const result = await befly.db.trans(async (tx) => {
    // 扣除转出方余额
    await tx.decrement("account", "balance", { userId: 1 }, 100);

    // 增加转入方余额
    await tx.increment("account", "balance", { userId: 2 }, 100);

    // 记录转账日志
    await tx.insData({
        table: "transfer_log",
        data: {
            fromUserId: 1,
            toUserId: 2,
            amount: 100
        }
    });

    return { success: true };
});

// 事务中抛出异常会自动回滚
await befly.db.trans(async (tx) => {
    await tx.updData({ table: "user", data: { balance: 0 }, where: { id: 1 } });

    throw new Error("业务校验失败"); // 自动回滚
});
```

---

## 多表联查

DbHelper 的查询方法（getOne、getList、getAll、getCount）支持通过 `joins` 参数进行多表联查。

### 简洁写法（推荐）

直接在查询方法中使用 `joins` 参数，无需手动构建 SQL。

```typescript
// 单条联查
const order = await befly.db.getOne({
    table: "order",
    joins: [{ table: "user", on: "order.user_id = user.id" }],
    fields: ["order.id", "order.totalAmount", "order.status", "user.username", "user.nickname"],
    where: { "order.id": orderId }
});
// 返回: { id: 1, totalAmount: 100, status: 'paid', username: 'john', nickname: '张三' }

// 分页联查
const result = await befly.db.getList({
    table: "order",
    joins: [
        { table: "user", on: "order.userId = user.id" },
        { table: "product", on: "order.productId = product.id" }
    ],
    fields: ["order.id", "order.totalAmount", "user.username", "product.name AS productName"],
    where: { "order.status": "paid" },
    orderBy: ["order.createdAt#DESC"],
    page: 1,
    limit: 10
});
// 返回: { list: [...], total: 100, page: 1, limit: 10, pages: 10 }

// 联查计数
const count = await befly.db.getCount({
    table: "order",
    joins: [{ table: "user", on: "order.userId = user.id" }],
    where: { "order.state": 1, "user.state": 1 }
});

// 联查全部
const allOrders = await befly.db.getAll({
    table: "order",
    joins: [{ table: "user", on: "order.userId = user.id" }],
    fields: ["order.id", "user.username"],
    where: { "order.state": 1 },
    orderBy: ["order.id#DESC"]
});
// 返回: { lists: [...最多10000条], total: 真实总数 }
```

### JoinOption 参数说明

```typescript
interface JoinOption {
    /** JOIN 类型：'left' | 'right' | 'inner'，默认 'left' */
    type?: "left" | "right" | "inner";
    /** 表名（不支持别名） */
    table: string;
    /** JOIN 条件（如 'order.user_id = user.id'） */
    on: string;
}
```

**示例：**

```typescript
joins: [
    { table: "user", on: "order.userId = user.id" }, // LEFT JOIN（默认）
    { type: "left", table: "product", on: "order.productId = product.id" }, // LEFT JOIN
    { type: "inner", table: "category", on: "product.categoryId = category.id" }, // INNER JOIN
    { type: "right", table: "warehouse", on: "product.warehouseId = warehouse.id" } // RIGHT JOIN
];
```

### 联查注意事项

1. **使用完整表名**：字段需要带完整表名（如 `order.id`, `user.username`）
2. **字段自动转换**：`order.userId` 会自动转换为 `order.user_id`
3. **结果自动转换**：返回结果的字段名会自动转为小驼峰
4. **State 过滤**：默认只添加主表的 `state > 0`，联表需在 where 中显式指定

### 完整示例：订单列表 API

```typescript
export default {
    name: "订单列表",
    fields: {
        keyword: { name: "关键词", type: "string", max: 50 },
        status: { name: "状态", type: "string" },
        page: Fields.page,
        limit: Fields.limit
    },
    handler: async (befly, ctx) => {
        const where: any = {
            "order.state": 1,
            "user.state": 1
        };

        // 关键词搜索
        if (ctx.body.keyword) {
            where.$or = [{ "user.username$like": `%${ctx.body.keyword}%` }, { "user.nickname$like": `%${ctx.body.keyword}%` }, { "product.name$like": `%${ctx.body.keyword}%` }];
        }

        // 状态过滤
        if (ctx.body.status) {
            where["order.status"] = ctx.body.status;
        }

        const result = await befly.db.getList({
            table: "order",
            joins: [
                { table: "user", on: "order.userId = user.id" },
                { table: "product", on: "order.productId = product.id" }
            ],
            fields: ["order.id", "order.quantity", "order.totalAmount", "order.status", "order.createdAt", "user.username", "user.nickname", "product.name AS productName", "product.price AS productPrice"],
            where: where,
            orderBy: ["order.createdAt#DESC"],
            page: ctx.body.page,
            limit: ctx.body.limit
        });

        return befly.tool.Yes("查询成功", result);
    }
};
```

---

### 使用 query 原始 SQL

对于更复杂的场景（如 GROUP BY、子查询等），可以使用 `befly.db.query()` 执行原始 SQL。

```typescript
// 带统计的联查：用户及其订单数量
const usersWithOrderCount = await befly.db.query(
    `SELECT
        u.id, u.username, u.nickname,
        COUNT(o.id) AS orderCount,
        COALESCE(SUM(o.total_amount), 0) AS totalSpent
     FROM user u
     LEFT JOIN \`order\` o ON u.id = o.user_id AND o.state > 0
     WHERE u.state > 0
     GROUP BY u.id
     ORDER BY totalSpent DESC
     LIMIT ?`,
    [20]
);

// 需要手动转换字段名
import { arrayKeysToCamel } from "befly/lib/arrayKeysToCamel";
const list = arrayKeysToCamel(usersWithOrderCount);
```

---

## Where 条件语法

### 基础条件

```typescript
// 等于
where: { id: 1 }
// → WHERE id = 1

// 多条件（AND）
where: { state: 1, status: 2 }
// → WHERE state = 1 AND status = 2
```

### 比较操作符

| 操作符         | 说明     | SQL  |
| -------------- | -------- | ---- |
| `$ne` / `$not` | 不等于   | `!=` |
| `$gt`          | 大于     | `>`  |
| `$gte`         | 大于等于 | `>=` |
| `$lt`          | 小于     | `<`  |
| `$lte`         | 小于等于 | `<=` |

**两种写法：**

```typescript
// 写法1：一级属性格式（推荐）
where: {
    age$gt: 18,
    age$lte: 60
}
// → WHERE age > 18 AND age <= 60

// 写法2：嵌套对象格式
where: {
    age: { $gt: 18, $lte: 60 }
}
// → WHERE age > 18 AND age <= 60
```

### 逻辑操作符

**$or - 或条件**

```typescript
// 用户名或邮箱匹配
where: {
    $or: [{ username: "admin" }, { email: "admin@example.com" }];
}
// → WHERE (username = 'admin' OR email = 'admin@example.com')
```

**$and - 与条件**

```typescript
// 显式 AND（通常不需要，多条件默认就是 AND）
where: {
    $and: [{ state: 1 }, { status: 2 }];
}
// → WHERE state = 1 AND status = 2
```

**组合使用**

```typescript
// 复杂条件
where: {
    state: 1,
    $or: [
        { roleCode: 'admin' },
        { roleCode: 'super' }
    ]
}
// → WHERE state = 1 AND (role_code = 'admin' OR role_code = 'super')
```

### 范围操作符

**$in - 在列表中**

```typescript
where: {
    categoryId$in: [1, 2, 3];
}
// → WHERE category_id IN (1, 2, 3)

where: {
    status$in: ["pending", "processing"];
}
// → WHERE status IN ('pending', 'processing')
```

**$nin / $notIn - 不在列表中**

```typescript
where: {
    state$nin: [0, 2];
}
// → WHERE state NOT IN (0, 2)
```

**$between - 区间**

```typescript
where: {
    age$between: [18, 60];
}
// → WHERE age BETWEEN 18 AND 60

where: {
    createdAt$between: [startTime, endTime];
}
// → WHERE created_at BETWEEN {startTime} AND {endTime}
```

**$notBetween - 不在区间**

```typescript
where: {
    price$notBetween: [100, 500];
}
// → WHERE price NOT BETWEEN 100 AND 500
```

### 空值操作符

**$null - 为空**

```typescript
where: {
    deletedAt$null: true;
}
// → WHERE deleted_at IS NULL
```

**$notNull - 不为空**

```typescript
where: {
    email$notNull: true;
}
// → WHERE email IS NOT NULL
```

### 模糊匹配

**$like - 模糊匹配**

```typescript
// 包含
where: {
    username$like: "%admin%";
}
// → WHERE username LIKE '%admin%'

// 以...开头
where: {
    email$like: "test%";
}
// → WHERE email LIKE 'test%'

// 以...结尾
where: {
    phone$like: "%1234";
}
// → WHERE phone LIKE '%1234'
```

**$notLike - 不匹配**

```typescript
where: {
    username$notLike: "%test%";
}
// → WHERE username NOT LIKE '%test%'
```

---

## 字段选择语法

### 查询所有字段

```typescript
// 以下三种方式等效
fields: [];
fields: undefined;
// 不传 fields 参数
```

### 指定字段

```typescript
fields: ["id", "username", "email"];
// → SELECT id, username, email
```

### 排除字段

使用 `!` 前缀排除字段（查询除指定字段外的所有字段）。

```typescript
fields: ["!password", "!token", "!salt"];
// → SELECT id, username, email, created_at, ... (除了 password, token, salt)
```

> ⚠️ **注意**：不能混用指定字段和排除字段。

---

## 排序语法

使用 `字段#方向` 格式，方向为 `ASC`（升序）或 `DESC`（降序）。

```typescript
// 单字段排序
orderBy: ["createdAt#DESC"];
// → ORDER BY created_at DESC

// 多字段排序
orderBy: ["sort#ASC", "id#DESC"];
// → ORDER BY sort ASC, id DESC
```

---

## 系统字段说明

每条记录自动包含以下系统字段：

| 字段         | 类型    | 说明               | 插入时     | 更新时       |
| ------------ | ------- | ------------------ | ---------- | ------------ |
| `id`         | BIGINT  | 主键，基于时间生成 | 自动生成   | 不可修改     |
| `created_at` | BIGINT  | 创建时间戳         | 自动生成   | 不可修改     |
| `updated_at` | BIGINT  | 更新时间戳         | 自动生成   | 自动更新     |
| `deleted_at` | BIGINT  | 删除时间戳         | 不生成     | 软删除时设置 |
| `state`      | TINYINT | 状态               | 强制设为 1 | 可修改       |

### State 状态值

| 值  | 含义   | 说明           |
| --- | ------ | -------------- |
| 0   | 已删除 | 软删除后的状态 |
| 1   | 正常   | 默认状态       |
| 2   | 禁用   | 禁用状态       |

### 默认 State 过滤

所有查询方法默认添加 `state > 0` 条件，**仅过滤软删除的数据（state=0）**。

**过滤效果**：

| state 值 | 默认查询结果        |
| -------- | ------------------- |
| 0        | ❌ 被过滤（软删除） |
| 1        | ✅ 可查询（正常）   |
| 2        | ✅ 可查询（禁用）   |

> ⚠️ **注意**：禁用数据（state=2）默认**可以**查询到，如需过滤禁用数据，需显式指定 `state: 1`。

```typescript
// 默认查询：state > 0，包含正常和禁用数据
getOne({ table: "user", where: { id: 1 } });
// → WHERE id = 1 AND state > 0

// 只查询正常状态的数据
getList({ table: "user", where: { state: 1 } });
// → WHERE state = 1

// 只查询禁用状态的数据
getList({ table: "user", where: { state: 2 } });
// → WHERE state = 2

// 查询所有状态（包括软删除）
getOne({ table: "user", where: { id: 1, state$gte: 0 } });
// → WHERE id = 1 AND state >= 0
```

---

## 完整示例

### 用户管理 API

```typescript
// 用户列表
export default {
    name: "用户列表",
    fields: {
        keyword: { name: "关键词", type: "string", max: 50 },
        departmentId: { name: "部门ID", type: "number" },
        page: Fields.page,
        limit: Fields.limit
    },
    handler: async (befly, ctx) => {
        const where: any = {};

        // 关键词搜索
        if (ctx.body.keyword) {
            where.$or = [{ username$like: `%${ctx.body.keyword}%` }, { nickname$like: `%${ctx.body.keyword}%` }, { email$like: `%${ctx.body.keyword}%` }];
        }

        // 部门过滤
        if (ctx.body.departmentId) {
            where.departmentId = ctx.body.departmentId;
        }

        const result = await befly.db.getList({
            table: "user",
            fields: ["!password", "!token"],
            where: where,
            orderBy: ["createdAt#DESC"],
            page: ctx.body.page,
            limit: ctx.body.limit
        });

        return befly.tool.Yes("查询成功", result);
    }
};
```

### 订单创建（事务）

```typescript
export default {
    name: "创建订单",
    fields: {
        productId: { name: "商品ID", type: "number" },
        quantity: { name: "数量", type: "number", min: 1 }
    },
    required: ["productId", "quantity"],
    handler: async (befly, ctx) => {
        const result = await befly.db.trans(async (tx) => {
            // 1. 查询商品
            const product = await tx.getOne({
                table: "product",
                where: { id: ctx.body.productId }
            });

            if (!product) {
                throw new Error("商品不存在");
            }

            if (product.stock < ctx.body.quantity) {
                throw new Error("库存不足");
            }

            // 2. 扣减库存
            await tx.decrement("product", "stock", { id: ctx.body.productId }, ctx.body.quantity);

            // 3. 创建订单
            const orderId = await tx.insData({
                table: "order",
                data: {
                    userId: ctx.user.id,
                    productId: ctx.body.productId,
                    quantity: ctx.body.quantity,
                    totalAmount: product.price * ctx.body.quantity,
                    status: "pending"
                }
            });

            return { orderId: orderId };
        });

        return befly.tool.Yes("订单创建成功", result);
    }
};
```

### 复杂查询

```typescript
// 查询最近7天内，状态为正常或待审核的文章
const articles = await befly.db.getList({
    table: "article",
    fields: ["id", "title", "authorId", "viewCount", "createdAt"],
    where: {
        createdAt$gte: Date.now() - 7 * 24 * 60 * 60 * 1000,
        $or: [{ status: "published" }, { status: "pending" }],
        categoryId$in: [1, 2, 3]
    },
    orderBy: ["viewCount#DESC", "createdAt#DESC"],
    page: 1,
    limit: 20
});
```
