# CURD 数据库操作文档

基于 MariaDB 的自定义数据库操作库，提供链式 SQL 构造器和便捷的 CRUD 操作方法。

注意：自 v3 起，数据库管理类名称统一为 SqlManager，并从插件内联实现迁移到 `utils/sqlManager.js`，由插件 `plugins/db.js` 在初始化时创建实例并挂载到 `befly.db`。

## 特性

- ✅ 基于 MariaDB 原生 Promise API
- ✅ 支持链式 SQL 构造器
- ✅ 防 SQL 注入（参数化查询）
- ✅ **字段和表名自动转义（反引号保护）**
- ✅ 支持事务操作
- ✅ 支持连接池管理
- ✅ 支持 leftJoin 关联查询
- ✅ 支持高级 where 条件（$in, $like, $gt 等）
- ✅ 支持分页查询
- ✅ 完善的错误处理
- ✅ 状态字段自动管理（软删除）
- ✅ **严格的数据库约束（NOT NULL + 默认值）**
- ✅ **优化的字段类型（BIGINT状态字段，管道分隔数组）**

## 数据库字段约束

### 字段定义格式（7个属性）

所有自定义字段使用标准格式：`名称|类型|最小值|最大值|默认值|是否索引|正则约束`

### 严格约束策略

- **所有用户定义字段**: 自动添加 `NOT NULL` 约束
- **默认值处理**:
    - `string/text/array`: 默认为 `''`（空字符串）
    - `number`: 默认为 `0`
    - 如指定默认值则使用指定值
- **系统字段约束**:
    - **所有系统字段**: `NOT NULL DEFAULT 0`（统一约束）
    - `created_at/updated_at`: 创建和更新时间戳
    - `deleted_at`: 删除时间戳（0表示未删除，时间戳表示删除时间）
    - `state`: 状态字段（0表示正常状态）### 字段类型优化

- **状态字段**: 使用 `BIGINT` 类型（支持大数值状态）
- **数组存储**: 使用管道分隔格式 `value1|value2|value3`（替代JSON）
- **长度处理**: 直接使用 `max` 值作为字段长度

### 示例字段定义

```javascript
// 字符串字段（带约束）
'用户名|string|2|50|test|1|^[a-zA-Z0-9_]+$';
// 生成: `用户名` VARCHAR(50) NOT NULL DEFAULT 'test' COMMENT "..."

// 数字字段
'年龄|number|0|150|25|1|';
// 生成: `年龄` BIGINT NOT NULL DEFAULT 25 COMMENT "..."

// 数组字段（管道分隔）
'标签|array|1|100|tag1{pipe}tag2|0|';
// 生成: `标签` VARCHAR(100) NOT NULL DEFAULT 'tag1{pipe}tag2' COMMENT "..."
```

## 环境配置

在 `.env` 文件中配置数据库连接信息：

```bash
# 启用 MySQL
MYSQL_ENABLE=1

# 数据库连接配置
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DB=test
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_POOL_MAX=10
MYSQL_DEBUG=0

# 时区配置
TIMEZONE// 电商订单处理事务
const processOrder = async (orderData) => {
    const result = await db.trans(async (tx) => {cal
```

## 基本用法

### 1. 获取数据库实例

```javascript
export default async function userApi(befly) {
    const { db } = befly;
    // db 为 SqlManager 实例（来源：utils/sqlManager.js）
}
```

## 字段和表名自动转义

### 安全性保障

本库自动为所有字段名和表名添加反引号（`）转义，防止SQL注入和关键字冲突：

```javascript
// 用户输入
const users = await db.getList('users', {
    where: { name: 'John', user_id: 123 },
    fields: ['id', 'name', 'email']
});

// 自动生成的安全SQL
// SELECT `id`, `name`, `email` FROM `users` WHERE `name` = ? AND `user_id` = ?
```

### 转义规则

#### 字段名转义

```javascript
// 普通字段名
'name' → '`name`'
'user_id' → '`user_id`'
'created_at' → '`created_at`'

// 表.字段格式（多表联查）
'users.name' → '`users`.`name`'
'orders.user_id' → '`orders`.`user_id`'

// 别名支持
'name AS user_name' → '`name` AS user_name'
'users.name AS user_name' → '`users`.`name` AS user_name'

// 通配符保持不变
'*' → '*'
'users.*' → '`users`.*'

// 函数调用保持不变
'COUNT(*)' → 'COUNT(*)'
'MAX(price)' → 'MAX(price)'
'CONCAT(first_name, last_name)' → 'CONCAT(first_name, last_name)'

// 已有反引号保持不变
'`name`' → '`name`'
'`users`.`name`' → '`users`.`name`'
```

#### 表名转义

```javascript
// 普通表名
'users' → '`users`'
'user_orders' → '`user_orders`'

// 表别名支持
'users u' → '`users` u'
'user_orders uo' → '`user_orders` uo'

// 已有反引号保持不变
'`users`' → '`users`'
'`users` u' → '`users` u'
```

### 实际应用示例

#### 防止关键字冲突

```javascript
// 当字段名是MySQL关键字时，自动转义保护
const result = await db.getList('orders', {
    where: {
        order: 'pending', // order 是关键字，自动转义为 `order`
        group: 'vip', // group 是关键字，自动转义为 `group`
        select: 'premium' // select 是关键字，自动转义为 `select`
    },
    fields: ['id', 'order', 'group', 'select']
});

// 生成的安全SQL：
// SELECT `id`, `order`, `group`, `select` FROM `orders`
// WHERE `order` = ? AND `group` = ? AND `select` = ?
```

#### 多表联查转义

```javascript
const result = await db.getList('users u', {
    where: {
        'u.status': 1,
        'p.published': true,
        'c.name': 'Technology'
    },
    fields: ['u.id', 'u.name', 'p.title', 'c.name as category'],
    leftJoins: ['posts p ON u.id = p.user_id', 'categories c ON p.category_id = c.id'],
    orderBy: ['u.created_at#DESC', 'p.updated_at#DESC']
});

// 生成的安全SQL：
// SELECT `u`.`id`, `u`.`name`, `p`.`title`, `c`.`name` as category
// FROM `users` u
// LEFT JOIN `posts` p ON u.id = p.user_id
// LEFT JOIN `categories` c ON p.category_id = c.id
// WHERE `u`.`status` = ? AND `p`.`published` = ? AND `c`.`name` = ?
// ORDER BY `u`.`created_at` DESC, `p`.`updated_at` DESC
```

#### 特殊字符和中文字段

```javascript
// 支持包含特殊字符或中文的字段名
const result = await db.getList('products', {
    where: {
        'product-name': 'iPhone', // 包含连字符
        用户名: 'John', // 中文字段名
        field_with_underscore: 'value' // 下划线字段
    },
    fields: ['id', 'product-name', '用户名', 'field_with_underscore']
});

// 自动转义为安全格式：
// SELECT `id`, `product-name`, `用户名`, `field_with_underscore`
// FROM `products`
// WHERE `product-name` = ? AND `用户名` = ? AND `field_with_underscore` = ?
```

### 兼容性说明

- ✅ **向后兼容**：所有现有查询代码无需修改，自动享受转义保护
- ✅ **智能识别**：自动识别函数、通配符、已转义字段，不会重复处理
- ✅ **性能优化**：转义处理在查询构建阶段完成，不影响执行性能
- ✅ **多表支持**：完美支持多表联查的字段转义
- ✅ **别名友好**：正确处理字段和表的别名

### 2. 简单查询

#### getDetail - 获取单条记录

```javascript
// 基础用法
const user = await db.getDetail('users', { id: 1 });

// 指定字段
const user = await db.getDetail('users', {
    where: { id: 1 },
    fields: ['id', 'name', 'email']
});

// 支持表别名
const user = await db.getDetail('users u', {
    where: { 'u.id': 1, 'u.status': 1 }
});
```

#### getList - 获取列表（支持分页）

```javascript
// 基础分页查询
const result = await db.getList('users', {
    where: { status: 1 },
    orderBy: ['created_at#DESC'],
    page: 1,
    pageSize: 10
});

// 返回结果结构
{
    list: [...],      // 数据列表
    total: 100,       // 总记录数
    page: 1,          // 当前页
    pageSize: 10      // 每页大小
}

// 复杂查询
const result = await db.getList('users', {
    where: {
        status: 1,
        role: 'admin'
    },
    fields: ['id', 'name', 'email', 'created_at'],
    orderBy: ['created_at#DESC', 'name#ASC'],
    page: 1,
    pageSize: 20
});
```

#### getAll - 获取所有记录

```javascript
// 获取所有符合条件的记录
const users = await db.getAll('users', {
    where: { status: 1 },
    orderBy: ['name#ASC']
});

// 限制字段
const users = await db.getAll('users', {
    where: { status: 1 },
    fields: ['id', 'name'],
    orderBy: ['created_at#DESC']
});
```

#### getCount - 获取记录总数

```javascript
// 基础计数
const count = await db.getCount('users', {
    where: { status: 1 }
});

// 支持 leftJoin 的计数
const count = await db.getCount('users u', {
    where: { 'u.status': 1, 'p.status': 1 },
    leftJoins: ['posts p ON u.id = p.user_id']
});

// 使用高级 where 条件
const count = await db.getCount('users', {
    where: {
        status: 1,
        created_at$gte: '2024-01-01',
        role$in: ['admin', 'user']
    }
});
```

### 3. 增删改操作

#### insData - 插入数据

```javascript
// 插入单条记录
const result = await db.insData('users', {
    name: 'John Doe',
    email: 'john@example.com',
    status: 1,
    created_at: new Date()
});

// 获取插入的 ID
console.log(result.insertId);
```

#### updData - 更新数据

```javascript
// 更新数据
const result = await db.updData(
    'users',
    {
        name: 'Updated Name',
        updated_at: new Date()
    },
    { id: 1 } // where 条件
);

// 获取影响的行数
console.log(result.affectedRows);
```

#### delData - 删除数据

```javascript
// 物理删除数据
const result = await db.delData(
    'users',
    { id: 1 } // where 条件
);

console.log(result.affectedRows);
```

#### delData2 - 软删除数据

```javascript
// 软删除数据（将 state 设置为 2）
const result = await db.delData2(
    'users',
    { id: 1 } // where 条件
);

// 软删除会自动：
// 1. 将 state 设置为 2
// 2. 更新 updated_at 时间戳
console.log(result.affectedRows);
```

```javascript
// 删除数据（软删除）
const result = await db.delData('users', {
    id: 1,
    status: 0
});

// 批量删除
const result = await db.delData('users', {
    status: 0,
    created_at$lt: '2023-01-01'
});
```

#### batchInsert - 批量插入

```javascript
// 批量插入
const users = [
    { name: 'User1', email: 'user1@example.com' },
    { name: 'User2', email: 'user2@example.com' },
    { name: 'User3', email: 'user3@example.com' }
];

const result = await db.batchInsert('users', users);
```

## 高级查询条件

### 支持的操作符

#### 操作符对照表

| 操作符   | 一级属性格式                       | SQL 输出                  | 说明             |
| -------- | ---------------------------------- | ------------------------- | ---------------- |
| 等于     | `{ name: 'John' }`                 | `name = ?`                | 基础等于条件     |
| 不等于   | `{ 'status$ne': 0 }`               | `status != ?`             | 不等于           |
| 大于     | `{ 'age$gt': 18 }`                 | `age > ?`                 | 大于             |
| 大于等于 | `{ 'age$gte': 18 }`                | `age >= ?`                | 大于等于         |
| 小于     | `{ 'age$lt': 65 }`                 | `age < ?`                 | 小于             |
| 小于等于 | `{ 'age$lte': 65 }`                | `age <= ?`                | 小于等于         |
| 包含     | `{ 'role$in': ['admin', 'user'] }` | `role IN (?, ?)`          | IN 条件          |
| 不包含   | `{ 'status$nin': [0, -1] }`        | `status NOT IN (?, ?)`    | NOT IN 条件      |
| 模糊匹配 | `{ 'name$like': '%john%' }`        | `name LIKE ?`             | LIKE 条件        |
| 不匹配   | `{ 'name$notLike': '%test%' }`     | `name NOT LIKE ?`         | NOT LIKE 条件    |
| 区间     | `{ 'age$between': [18, 65] }`      | `age BETWEEN ? AND ?`     | BETWEEN 条件     |
| 不在区间 | `{ 'age$notBetween': [18, 65] }`   | `age NOT BETWEEN ? AND ?` | NOT BETWEEN 条件 |
| 为空     | `{ 'deleted_at$null': true }`      | `deleted_at IS NULL`      | 空值检查         |
| 不为空   | `{ 'email$notNull': true }`        | `email IS NOT NULL`       | 非空检查         |

#### 基础用法

```javascript
// 比较操作符
const users = await db.getList('users', {
    where: {
        age$gt: 18, // age > 18
        score$gte: 60, // score >= 60
        level$lt: 10, // level < 10
        points$lte: 1000, // points <= 1000
        status$ne: 0 // status != 0
    }
});

// 包含操作符
const users = await db.getList('users', {
    where: {
        role$in: ['admin', 'moderator'], // role IN (...)
        status$nin: [0, -1], // status NOT IN (...)
        name$like: '%john%', // name LIKE '%john%'
        email$notLike: '%@temp.com' // email NOT LIKE '%@temp.com'
    }
});

// 范围和空值操作符
const users = await db.getList('users', {
    where: {
        created_at$between: ['2024-01-01', '2024-12-31'], // BETWEEN
        deleted_at$null: true, // IS NULL
        email$notNull: true // IS NOT NULL
    }
});

// 混合使用
const users = await db.getList('users', {
    where: {
        status: 1, // 等于条件
        age$gte: 18, // 大于等于
        role$in: ['admin', 'user'], // IN 条件
        name$like: '%john%' // LIKE 条件
    }
});
```

### 逻辑操作符

```javascript
// AND 条件（默认）
const users = await db.getList('users', {
    where: {
        status: 1,
        role: 'admin',
        age$gte: 18
    }
});

// OR 条件
const users = await db.getList('users', {
    where: {
        status: 1,
        $or: [{ role: 'admin' }, { permissions$like: '%manage%' }]
    }
});

// 复杂组合条件
const users = await db.getList('users', {
    where: {
        $and: [
            { status: 1 },
            {
                $or: [{ role: 'admin' }, { level$gte: 5 }]
            }
        ]
    }
});

// 实际应用示例
const users = await db.getList('users', {
    where: {
        age$between: [18, 65], // 年龄在18-65之间
        role$in: ['admin', 'user'], // 角色是admin或user
        status$ne: 0, // 状态不等于0
        created_at$gte: '2024-01-01', // 创建时间大于等于2024-01-01
        email$notNull: true, // 邮箱不为空
        name$like: '%john%' // 姓名包含john
    }
});
```

## leftJoin 关联查询

### 基础用法

```javascript
// 字符串格式（推荐）
const users = await db.getList('users u', {
    where: { 'u.status': 1 },
    fields: ['u.*', 'p.title', 'p.content'],
    leftJoins: ['posts p ON u.id = p.user_id']
});

// 对象格式
const users = await db.getList('users u', {
    where: { 'u.status': 1 },
    fields: ['u.*', 'up.avatar', 'up.bio'],
    leftJoins: [{ table: 'user_profiles up', on: 'u.id = up.user_id' }]
});
```

### 多表关联

```javascript
// 多个 leftJoin
const articles = await db.getList('articles a', {
    where: { 'a.status': 1 },
    fields: ['a.id', 'a.title', 'a.summary', 'a.created_at', 'u.name as author_name', 'c.name as category_name', 'COUNT(cm.id) as comment_count'],
    leftJoins: ['users u ON a.user_id = u.id', 'categories c ON a.category_id = c.id', 'comments cm ON a.id = cm.article_id'],
    groupBy: ['a.id'],
    orderBy: ['a.created_at#DESC'],
    page: 1,
    pageSize: 10
});
```

### 复杂关联查询

```javascript
// 带条件的关联
const usersWithLatestPost = await db.getAll('users u', {
    where: { 'u.status': 1 },
    fields: ['u.*', 'p.title as latest_post', 'p.created_at as post_date'],
    leftJoins: ['posts p ON u.id = p.user_id AND p.id = (SELECT MAX(id) FROM posts WHERE user_id = u.id AND status = 1)'],
    orderBy: ['u.created_at#DESC']
});
```

## SQL 构造器直接使用

### 基础链式调用

```javascript
// 获取查询构造器（来自 utils/sqlManager.js 暴露的 db.query()）
const builder = db.query();

// 链式构建查询
const { sql, params } = builder.select(['u.id', 'u.name', 'u.email']).from('users u').where('u.status', 1).where({ 'u.age$gte': 18 }).leftJoin('user_profiles up', 'u.id = up.user_id').orderBy(['u.created_at#DESC']).limit(10).toSelectSql();

// 执行查询
const result = await db.execute(sql, params);
```

### 复杂查询构建

```javascript
const builder = db
    .query()
    .select(['u.id', 'u.name', 'u.email', 'up.avatar', 'COUNT(p.id) as post_count', 'MAX(p.created_at) as last_post_date'])
    .from('users u')
    .leftJoin('user_profiles up', 'u.id = up.user_id')
    .leftJoin('posts p', 'u.id = p.user_id AND p.status = 1')
    .where({
        'u.status': 1,
        'u.created_at$gte': '2024-01-01'
    })
    .groupBy(['u.id'])
    .having('post_count > 0')
    .orderBy(['last_post_date#DESC', 'u.name#ASC'])
    .limit(50);

const { sql, params } = builder.toSelectSql();
const users = await db.execute(sql, params);
```

## 事务操作

### 基础事务

```javascript
// 简单事务 - 使用原始SQL
const result = await db.trans(async (tx) => {
    // 在事务中执行多个操作
    await tx.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['John', 'john@example.com']);
    await tx.execute('UPDATE users SET status = 1 WHERE name = ?', ['John']);

    return { success: true };
});
```

### 高级事务 - 支持所有CURD方法

事务中支持所有高级数据操作方法：`getDetail`、`getList`、`getAll`、`insData`、`updData`、`delData`、`delData2`、`getCount`、`insBatch`

```javascript
// 使用高级方法的事务
const result = await db.trans(async (tx) => {
    // 查询用户
    const user = await tx.getDetail('users', { name: 'John' });

    if (!user) {
        // 创建用户
        const newUser = await tx.insData('users', {
            name: 'John',
            email: 'john@example.com',
            status: 1
        });

        // 创建用户配置
        await tx.insData('user_profiles', {
            user_id: newUser.insertId,
            avatar: 'default.png',
            bio: '新用户'
        });
    } else {
        // 更新用户信息
        await tx.updData('users', { status: 1, last_login: new Date() }, { id: user.id });
    }

    // 获取用户列表验证
    const users = await tx.getList('users', {
        where: { status: 1 },
        page: 1,
        pageSize: 10
    });

    return { success: true, userCount: users.total };
});
```

### 复杂业务事务

```javascript
// 复杂业务事务示例
const result = await db.trans(async (tx) => {

// 使用示例
const orderData = {
    userId: 123,
    totalAmount: 299.99,
    productIds: [1, 2, 3],
    items: [
        { productId: 1, quantity: 2, price: 99.99 },
        { productId: 2, quantity: 1, price: 49.99 },
        { productId: 3, quantity: 1, price: 149.99 }
    ]
};

const result = await processOrder(orderData);
```

### 事务中支持的方法

| 方法                          | 描述                  | 用法示例                                                                     |
| ----------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `execute(sql, params)`        | 执行原始SQL           | `await tx.execute('SELECT * FROM users WHERE id = ?', [1])`                  |
| `query(sql, params)`          | 执行查询（同execute） | `await tx.query('INSERT INTO users (name) VALUES (?)', ['John'])`            |
| `getDetail(table, options)`   | 获取单条记录          | `await tx.getDetail('users', { id: 1 })`                                     |
| `getList(table, options)`     | 获取列表（支持分页）  | `await tx.getList('users', { where: { status: 1 }, page: 1, pageSize: 10 })` |
| `getAll(table, options)`      | 获取所有记录          | `await tx.getAll('users', { where: { status: 1 } })`                         |
| `insData(table, data)`        | 插入单条记录          | `await tx.insData('users', { name: 'John', email: 'john@example.com' })`     |
| `updData(table, data, where)` | 更新记录              | `await tx.updData('users', { status: 1 }, { id: 1 })`                        |
| `delData(table, where)`       | 删除记录              | `await tx.delData('users', { id: 1 })`                                       |
| `delData2(table, where)`      | 软删除记录            | `await tx.delData2('users', { id: 1 })`                                      |
| `getCount(table, options)`    | 获取记录总数          | `await tx.getCount('users', { where: { status: 1 } })`                       |
| `insBatch(table, dataArray)`  | 批量插入              | `await tx.insBatch('users', [{ name: 'John' }, { name: 'Jane' }])`           |

### 事务特性

- ✅ **自动回滚**：任何错误都会自动回滚事务
- ✅ **完整CURD支持**：支持所有高级数据库操作方法
- ✅ **一级属性where条件**：事务中的方法完全支持新的where条件格式
- ✅ **自动ID和时间戳**：`insData` 和 `insBatch` 自动添加ID和时间戳
- ✅ **安全的更新删除**：`updData`、`delData` 和 `delData2` 必须提供where条件
- ✅ **JOIN查询支持**：`getDetail`、`getList`、`getAll` 支持leftJoin
- ✅ **状态字段和软删除**：自动添加状态字段，智能过滤已删除记录

## 状态字段和软删除功能

### 默认状态字段

所有通过 `insData` 和 `insBatch` 插入的数据都会自动添加 `state` 字段，默认值为 `0`：

```javascript
// 插入单条数据 - 自动添加 state: 0
await db.insData('users', {
    name: 'John',
    email: 'john@example.com'
});
// 实际插入的数据：{ name: 'John', email: 'john@example.com', state: 0, id: ..., created_at: ..., updated_at: ... }

// 指定状态值
await db.insData('users', {
    name: 'Jane',
    email: 'jane@example.com',
    state: 1 // 保持指定的状态值
});

// 批量插入 - 自动处理状态字段
await db.insBatch('users', [
    { name: 'User1' }, // 自动添加 state: 0
    { name: 'User2', state: 1 }, // 保持 state: 1
    { name: 'User3' } // 自动添加 state: 0
]);
```

### 自动软删除过滤

所有查询方法都会自动排除 `state = 2` 的记录（已删除状态）：

```javascript
// 这些查询都会自动排除 state=2 的记录
await db.getDetail('users', { id: 123 });
await db.getList('users', { name: 'John' });
await db.getAll('users', { age$gte: 18 });
await db.getCount('users', { status: 'active' });
```

### 显式状态查询

如果需要查询特定状态的记录，可以显式指定状态条件：

```javascript
// 只查询已删除的记录
await db.getAll('users', { state$eq: 2 });

// 查询所有记录（包括已删除的）
await db.getAll('users', { state$gte: 0 });

// 查询活跃状态的记录
await db.getAll('users', { state$in: [0, 1] });

// 直接使用 state 字段
await db.getDetail('users', { id: 123, state: 1 });
```

### 状态值约定

- `state: 0` - 正常状态（默认）
- `state: 1` - 其他业务状态（如禁用、待审核等）
- `state: 2` - 已删除状态（软删除）

### 软删除操作

要软删除记录，推荐使用专门的 `delData2` 方法：

```javascript
// 软删除用户（推荐方式）
await db.delData2('users', { id: 123 });

// 或者使用 updData 方法手动设置
await db.updData('users', { state: 2 }, { id: 123 });

// 恢复已删除的用户
await db.updData('users', { state: 0 }, { id: 123, state: 2 });
```

## orderBy 排序

### 支持的格式

```javascript
// 唯一支持的格式：一维数组，必须指定排序方向
const users = await db.getList('users', {
    orderBy: ['created_at#DESC', 'name#ASC', 'id#DESC']
});

// 单个字段排序
const users = await db.getList('users', {
    orderBy: ['created_at#DESC']
});

// 在查询构造器中使用
const builder = db
    .query()
    .from('users')
    .orderBy(['name#ASC', 'id#DESC']) // 必须是数组格式
    .limit(10);
```

### 排序规则

- **必须格式**：必须是数组，数组中每个元素必须是 `字段名#方向` 格式
- **必须方向**：每个字段都必须明确指定 `ASC`（升序）或 `DESC`（降序）
- **大小写不敏感**：`ASC`、`asc`、`DESC`、`desc` 都可以
- **多字段排序**：按数组顺序依次排序
- **严格验证**：不符合格式的会抛出错误

### 示例

```javascript
// ✅ 正确格式
const users = await db.getList('users', {
    orderBy: ['created_at#DESC'] // 按创建时间降序
});

// ✅ 多字段排序
const users = await db.getList('users', {
    orderBy: [
        'status#ASC', // 先按状态升序
        'created_at#DESC', // 再按创建时间降序
        'name#ASC' // 最后按姓名升序
    ]
});

// ✅ 大小写不敏感
const users = await db.getList('users', {
    orderBy: ['name#asc', 'id#desc']
});

// ✅ 在查询构造器中使用
const { sql, params } = db.query().select(['id', 'name', 'created_at']).from('users').where({ status: 1 }).orderBy(['created_at#DESC', 'name#ASC']).limit(20).toSelectSql();
```

### 错误示例

```javascript
// ❌ 不是数组格式
orderBy: 'created_at#DESC';

// ❌ 缺少排序方向
orderBy: ['created_at', 'name'];

// ❌ 无效排序方向
orderBy: ['created_at#INVALID'];

// ❌ 空字段名
orderBy: ['#ASC'];
```

## 错误处理

### 基础错误处理

```javascript
try {
    const users = await db.getList('users', {
        where: { status: 1 },
        page: 1,
        pageSize: 10
    });

    return users;
} catch (error) {
    console.error('查询用户失败:', error.message);
    throw error;
}
```

### 事务错误处理

```javascript
try {
    const result = await db.trans(async (tx) => {
        // 事务操作
        await tx.execute('INSERT INTO users (name) VALUES (?)', ['Test']);

        // 模拟错误
        if (someCondition) {
            throw new Error('业务逻辑错误');
        }

        await tx.execute('UPDATE users SET status = 1 WHERE name = ?', ['Test']);

        return { success: true };
    });
} catch (error) {
    // 事务会自动回滚
    console.error('事务执行失败:', error.message);
}
```

## 连接池监控

```javascript
// 获取连接池状态
const status = db.getPoolStatus();
console.log('连接池状态:', {
    activeConnections: status.activeConnections, // 活跃连接数
    totalConnections: status.totalConnections, // 总连接数
    idleConnections: status.idleConnections, // 空闲连接数
    taskQueueSize: status.taskQueueSize // 等待队列大小
});
```

## 最佳实践

### 1. 字段选择

```javascript
// ❌ 避免使用 SELECT *
const users = await db.getList('users');

// ✅ 明确指定需要的字段
const users = await db.getList('users', {
    fields: ['id', 'name', 'email', 'created_at']
});
```

### 2. 索引利用

```javascript
// ✅ 在 WHERE 条件中使用索引字段
const users = await db.getList('users', {
    where: {
        email: 'john@example.com', // email 字段有索引
        status: 1 // status 字段有索引
    }
});
```

### 3. 分页查询

```javascript
// ✅ 使用合理的分页大小
const users = await db.getList('users', {
    where: { status: 1 },
    page: 1,
    pageSize: 20 // 避免过大的 pageSize
});
```

### 4. 事务使用

```javascript
// ✅ 保持事务简短
const result = await db.trans(async (tx) => {
    // 只包含必要的数据库操作
    await tx.execute('INSERT INTO orders (user_id, amount) VALUES (?, ?)', [userId, amount]);
    await tx.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);

    // ❌ 不要在事务中进行耗时操作
    // await sendEmail(); // 这应该在事务外进行

    return { success: true };
});

// ✅ 在事务外进行其他操作
await sendEmail();
```

## 性能优化

### 1. 使用适当的查询方法

```javascript
// 获取单条记录时使用 getDetail
const user = await db.getDetail('users', { id: 1 });

// 获取列表时使用 getList（自动分页）
const users = await db.getList('users', {
    where: { status: 1 },
    page: 1,
    pageSize: 20
});

// 只有在确实需要所有记录时才使用 getAll
const allActiveUsers = await db.getAll('users', {
    where: { status: 1 }
});
```

### 2. 优化 JOIN 查询

```javascript
// ✅ 在 ON 条件中使用索引字段
const users = await db.getList('users u', {
    leftJoins: [
        'posts p ON u.id = p.user_id' // user_id 应该有索引
    ]
});

// ✅ 避免不必要的 JOIN
const users = await db.getList('users u', {
    where: { 'u.status': 1 },
    fields: ['u.id', 'u.name'], // 只选择需要的字段
    leftJoins: ['user_profiles up ON u.id = up.user_id']
});
```

这个数据库操作库提供了完整的 CRUD 功能，支持复杂查询和事务操作，是 Kysely 的优秀替代方案。
