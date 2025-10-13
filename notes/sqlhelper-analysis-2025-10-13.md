# SqlHelper 快捷方法详细分析报告

> 日期: 2025-10-13
> 分析对象: `core/utils/sqlHelper.ts` - SQL 快捷方法实现
> 分析方式: 逐方法审查 + 安全性分析 + 性能评估

## 📋 目录

1. [概述](#概述)
2. [方法详细分析](#方法详细分析)
3. [问题汇总](#问题汇总)
4. [修复优先级](#修复优先级)
5. [改进建议](#改进建议)

---

## 概述

### 架构优点

✅ **设计合理性**:

-   基于 SqlBuilder 构建，代码复用良好
-   自动处理系统字段（id、created_at、updated_at、state）
-   提供事务支持，满足复杂业务需求
-   接口设计简洁，易于使用

✅ **功能完整性**:

-   CRUD 操作完整（getDetail、getList、getAll、insData、updData、delData）
-   支持软删除和物理删除
-   提供辅助方法（exists、getFieldValue、increment、decrement）
-   批量操作支持（insDataBatch）

### 架构缺陷

⚠️ **安全性问题**:

-   increment/decrement 存在 SQL 注入风险
-   缺少输入参数校验

⚠️ **性能问题**:

-   insDataBatch 逐条插入，性能极差
-   getAll 无上限保护，可能内存溢出
-   getList 在大表上 COUNT 查询慢

⚠️ **可靠性问题**:

-   buildWhereClause 实现不可靠
-   错误处理不统一
-   依赖 Redis 生成 ID，无降级方案

---

## 方法详细分析

### 1. processDataForInsert()

**功能**: 预处理插入数据，强制生成系统字段

**实现**:

```typescript
private async processDataForInsert(data: Record<string, any>): Promise<Record<string, any>> {
    const processed = { ...data };
    processed.id = await this.befly.redis.genTimeID();
    const now = Date.now();
    processed.created_at = now;
    processed.updated_at = now;
    processed.state = 1;
    return processed;
}
```

**问题**:

| 级别  | 问题描述                                               | 影响               |
| ----- | ------------------------------------------------------ | ------------------ |
| ⚠️ P1 | 依赖 Redis (genTimeID)，如果 Redis 未启用会报错        | 无法离线使用       |
| ⚠️ P2 | 用户传入的 id/created_at/updated_at/state 会被强制覆盖 | 数据完整性         |
| ⚠️ P2 | created_at 和 updated_at 使用相同时间戳                | 无法区分创建和更新 |
| ⚠️ P2 | state=1 硬编码，缺少灵活性                             | 无法创建草稿状态   |

**改进建议**:

1. 检查 Redis 是否可用，提供友好的错误提示
2. 考虑支持自定义 state（如草稿、待审核等）
3. 文档中明确说明自动字段不可覆盖

---

### 2. addDefaultStateFilter()

**功能**: 自动过滤已删除数据

**实现**:

```typescript
private addDefaultStateFilter(where: WhereConditions | undefined, includeDeleted: boolean = false, customState?: WhereConditions): WhereConditions {
    if (includeDeleted) return where || {};
    if (customState) return where ? { ...where, ...customState } : customState;
    const stateFilter: WhereConditions = { state: { $gt: 0 } };
    return where ? { ...where, ...stateFilter } : stateFilter;
}
```

**问题**:

| 级别  | 问题描述                                     | 影响         |
| ----- | -------------------------------------------- | ------------ |
| ⚠️ P2 | 硬编码 state > 0，与软删除 state=0 耦合      | 扩展性差     |
| ⚠️ P2 | 如果用户 where 中已包含 state 条件，会被覆盖 | 查询结果错误 |
| ⚠️ P2 | customState 的优先级不明确                   | 使用困惑     |

**改进建议**:

1. 检查 where 中是否已有 state 条件，避免覆盖
2. 提供配置选项，允许自定义状态过滤逻辑
3. 文档中明确说明状态字段的语义

---

### 3. getDetail()

**功能**: 查询单条数据

**实现**:

```typescript
async getDetail<T = any>(options: QueryOptions): Promise<T | null> {
    const { table, fields = ['*'], where, includeDeleted = false, customState } = options;
    const builder = new SqlBuilder()
        .select(fields)
        .from(table)
        .where(this.addDefaultStateFilter(where, includeDeleted, customState))
        .limit(1);
    const { sql, params } = builder.toSelectSql();
    const result = await this.executeWithConn(sql, params);
    return result?.[0] || null;
}
```

**问题**:

| 级别  | 问题描述                                    | 影响         |
| ----- | ------------------------------------------- | ------------ |
| ⚠️ P2 | 没有 orderBy 参数，多条记录时返回结果不确定 | 结果不可预测 |
| ⚠️ P3 | fields 默认 ['*']，可能返回不需要的大字段   | 性能浪费     |

**改进建议**:

1. 添加 orderBy 参数，确保结果可预测
2. 文档中说明默认返回所有字段

---

### 4. getList()

**功能**: 分页查询列表

**实现**:

```typescript
async getList<T = any>(options: QueryOptions): Promise<ListResult<T>> {
    // 1. 查询总数
    const countBuilder = new SqlBuilder()
        .select(['COUNT(*) as total'])
        .from(table)
        .where(whereFiltered);
    const { sql: countSql, params: countParams } = countBuilder.toSelectSql();
    const countResult = await this.executeWithConn(countSql, countParams);
    const total = countResult?.[0]?.total || 0;

    // 2. 查询数据
    const offset = (page - 1) * limit;
    const dataBuilder = new SqlBuilder()
        .select(fields)
        .from(table)
        .where(whereFiltered)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);
    const { sql: dataSql, params: dataParams } = dataBuilder.toSelectSql();
    const list = (await this.executeWithConn(dataSql, dataParams)) || [];

    return { list, total, page, limit, pages: Math.ceil(total / limit) };
}
```

**问题**:

| 级别  | 问题描述                                | 影响           |
| ----- | --------------------------------------- | -------------- |
| ⚠️ P1 | page 和 limit 没有上限校验              | 可能查询百万行 |
| ⚠️ P2 | 两次查询效率问题（COUNT + SELECT）      | 性能开销       |
| ⚠️ P2 | orderBy 默认 ['id#DESC']，id 可能不存在 | 查询错误       |
| ⚠️ P2 | COUNT 查询在大表上可能很慢              | 性能瓶颈       |
| ⚠️ P2 | 如果 total=0，仍然执行第二次查询        | 浪费资源       |

**改进建议**:

1. 添加 page 和 limit 上限校验（如 page <= 10000, limit <= 1000）
2. 如果 COUNT 返回 0，跳过 SELECT 查询
3. orderBy 默认值改为空，由用户明确指定
4. 考虑提供"游标分页"选项（基于 id > lastId）
5. 提供"跳过 COUNT"选项，用于不需要总数的场景

---

### 5. getAll()

**功能**: 不分页查询所有数据

**实现**:

```typescript
async getAll<T = any>(options: Omit<QueryOptions, 'page' | 'limit'>): Promise<T[]> {
    const { table, fields = ['*'], where, orderBy, includeDeleted = false, customState } = options;
    const builder = new SqlBuilder()
        .select(fields)
        .from(table)
        .where(this.addDefaultStateFilter(where, includeDeleted, customState));
    if (orderBy) builder.orderBy(orderBy);
    const { sql, params } = builder.toSelectSql();
    return (await this.executeWithConn(sql, params)) || [];
}
```

**问题**:

| 级别  | 问题描述                                         | 影响         |
| ----- | ------------------------------------------------ | ------------ |
| 🚨 P0 | **危险**：没有 LIMIT，大表查询可能返回百万级数据 | **内存溢出** |
| 🚨 P0 | 没有任何安全限制，用户可以轻易打爆内存           | **系统崩溃** |
| ⚠️ P1 | 完全依赖用户自律，无保护措施                     | 风险极高     |

**改进建议**:

1. **【必须】** 添加硬性上限（如 maxLimit=10000）
2. **【必须】** 添加警告日志，当返回超过 1000 条时
3. 考虑自动添加 LIMIT 10000，防止意外
4. 文档中强调风险，推荐使用 getList 分页

---

### 6. insData()

**功能**: 插入单条数据

**实现**:

```typescript
async insData(options: InsertOptions): Promise<number> {
    const { table, data } = options;
    const processed = await this.processDataForInsert(data);
    const builder = new SqlBuilder();
    const { sql, params } = builder.toInsertSql(table, processed);
    const result = await this.executeWithConn(sql, params);
    return processed.id || result?.lastInsertRowid || 0;
}
```

**问题**:

| 级别  | 问题描述                         | 影响     |
| ----- | -------------------------------- | -------- |
| ⚠️ P1 | 依赖 Redis 生成 ID，无法离线使用 | 可用性差 |
| ⚠️ P2 | 返回 0 作为失败标识不明确        | 容易混淆 |

**改进建议**:

1. 提供降级方案（Redis 不可用时使用数据库自增 ID）
2. 插入失败时抛出明确的错误，而不是返回 0
3. 考虑返回完整的插入记录，而不仅仅是 ID

---

### 7. insDataBatch()

**功能**: 批量插入数据

**实现**:

```typescript
async insDataBatch(table: string, dataList: Record<string, any>[]): Promise<number[]> {
    const ids: number[] = [];
    for (const data of dataList) {
        const id = await this.insData({ table, data });
        ids.push(id);
    }
    return ids;
}
```

**问题**:

| 级别  | 问题描述                                     | 影响         |
| ----- | -------------------------------------------- | ------------ |
| 🚨 P0 | **严重性能问题**：逐条插入而非真正的批量插入 | **极慢**     |
| 🚨 P0 | N 次网络往返 + N 次 Redis 调用               | 网络开销巨大 |
| ⚠️ P1 | 没有事务保护，部分成功部分失败               | 数据不一致   |
| ⚠️ P1 | 批量数量没有限制（10000 条会很慢）           | 性能极差     |

**性能对比**:

```
插入 1000 条数据:
- 当前实现: 1000次 INSERT + 1000次 Redis 调用 ≈ 5-10秒
- 批量插入: 1次 INSERT VALUES (...), (...), (...) ≈ 50-100ms
性能差距: 50-200倍
```

**改进建议**:

1. **【必须】** 使用真正的批量插入: `INSERT INTO ... VALUES (...), (...), (...)`
2. **【必须】** 批量生成 ID（一次性从 Redis 获取 N 个 ID）
3. 添加批量数量限制（如最多 1000 条）
4. 自动包装在事务中，确保原子性
5. 提供进度回调，用于大批量插入

---

### 8. updData()

**功能**: 更新数据

**实现**:

```typescript
async updData(options: UpdateOptions): Promise<number> {
    const { table, data, where, includeDeleted = false } = options;
    const processed = { ...data };
    processed.updated_at = Date.now();
    const whereFiltered = this.addDefaultStateFilter(where, includeDeleted);
    const builder = new SqlBuilder().where(whereFiltered);
    const { sql, params } = builder.toUpdateSql(table, processed);
    const result = await this.executeWithConn(sql, params);
    return result?.changes || 0;
}
```

**问题**:

| 级别  | 问题描述                                      | 影响         |
| ----- | --------------------------------------------- | ------------ |
| ⚠️ P2 | 用户传入的 updated_at 会被强制覆盖            | 灵活性差     |
| ⚠️ P2 | includeDeleted=false 时，无法更新已删除的记录 | 功能限制     |
| ⚠️ P2 | 没有乐观锁支持（如基于版本号）                | 并发问题     |
| ⚠️ P2 | 批量更新可能影响多条记录，但没有明确提示      | 风险提示不足 |

**改进建议**:

1. 文档中说明 updated_at 会被自动更新
2. 考虑添加乐观锁支持（`WHERE version = ? AND ...`）
3. 提供"严格模式"，期望影响 1 条否则报错
4. 返回更新前后的数据对比

---

### 9. delData()

**功能**: 删除数据（软删除或物理删除）

**实现**:

```typescript
async delData(options: DeleteOptions): Promise<number> {
    const { table, where, hard = false } = options;
    if (hard) {
        const builder = new SqlBuilder().where(where);
        const { sql, params } = builder.toDeleteSql(table);
        const result = await this.executeWithConn(sql, params);
        return result?.changes || 0;
    } else {
        const data: Record<string, any> = {
            state: 0,
            updated_at: Date.now()
        };
        return await this.updData({
            table,
            data,
            where,
            includeDeleted: true
        });
    }
}
```

**问题**:

| 级别  | 问题描述                               | 影响     |
| ----- | -------------------------------------- | -------- |
| ⚠️ P2 | 软删除和物理删除混用，容易混淆         | 使用困惑 |
| ⚠️ P2 | 软删除后数据仍在表中，长期积累占用空间 | 存储浪费 |
| ⚠️ P2 | 物理删除没有二次确认，容易误删         | 数据安全 |
| ⚠️ P2 | 软删除时允许重复删除已删除的数据       | 语义不清 |

**改进建议**:

1. 物理删除添加安全检查（如必须传 `confirmHardDelete=true`）
2. 提供"真正删除"方法，定期清理软删除数据
3. 软删除时记录删除时间（deleted_at）
4. 文档中明确两种删除的区别和使用场景

---

### 10. trans()

**功能**: 执行事务

**实现**:

```typescript
async trans<T = any>(callback: TransactionCallback<T>): Promise<T> {
    if (this.isTransaction) {
        return await callback(this);
    }
    const conn = await this.befly.db.transaction();
    try {
        const trans = new SqlHelper(this.befly, conn);
        const result = await callback(trans);
        await conn.query('COMMIT');
        return result;
    } catch (error) {
        await conn.query('ROLLBACK');
        throw error;
    }
}
```

**问题**:

| 级别  | 问题描述                                        | 影响       |
| ----- | ----------------------------------------------- | ---------- |
| ⚠️ P1 | `this.befly.db.transaction()` 方法未找到实现    | 可能不可用 |
| ⚠️ P2 | `conn.query('COMMIT')` 使用字符串，不够类型安全 | 维护性差   |
| ⚠️ P2 | 嵌套事务检测依赖 isTransaction 标志，可能不准确 | 逻辑错误   |
| ⚠️ P2 | 事务超时没有处理，长事务可能导致死锁            | 可靠性差   |

**改进建议**:

1. 明确实现 transaction() 方法或使用标准 API
2. 使用类型化的 commit/rollback 方法
3. 添加事务超时保护（如 30 秒超时自动回滚）
4. 提供事务嵌套级别查询方法

---

### 11. exists()

**功能**: 检查数据是否存在

**实现**:

```typescript
async exists(options: Omit<QueryOptions, 'fields' | 'orderBy' | 'page' | 'limit'>): Promise<boolean> {
    const result = await this.getDetail({
        ...options,
        fields: ['1']
    });
    return !!result;
}
```

**问题**:

| 级别  | 问题描述                            | 影响       |
| ----- | ----------------------------------- | ---------- |
| ⚠️ P2 | 性能不佳：查询整行然后只检查存在性  | 性能浪费   |
| ⚠️ P2 | fields: ['1'] 可能被 state 过滤影响 | 结果不准确 |

**改进建议**:

1. 优化为 `SELECT EXISTS(SELECT 1 FROM ...)`
2. 或使用 `SELECT COUNT(1)` 检查
3. 添加 includeDeleted 参数，控制是否检查已删除数据

---

### 12. getFieldValue()

**功能**: 查询单个字段值

**实现**:

```typescript
async getFieldValue<T = any>(options: Omit<QueryOptions, 'fields'> & { field: string }): Promise<T | null> {
    const { field, ...queryOptions } = options;
    const result = await this.getDetail({
        ...queryOptions,
        fields: [field]
    });
    return result ? result[field] : null;
}
```

**问题**:

| 级别  | 问题描述                                      | 影响         |
| ----- | --------------------------------------------- | ------------ |
| ⚠️ P2 | 字段名注入风险（如 field = "id; DROP TABLE"） | **安全风险** |
| ⚠️ P3 | 如果字段不存在，返回 undefined 还是 null？    | 语义不清     |

**改进建议**:

1. 验证字段名格式，防止注入
2. 统一返回 null 而非 undefined
3. 提供批量查询多个字段的方法

---

### 13. increment() / decrement()

**功能**: 自增/自减字段

**实现**:

```typescript
async increment(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
    const sql = `UPDATE ${table} SET ${field} = ${field} + ? WHERE ${this.buildWhereClause(where)}`;
    const result = await this.executeWithConn(sql, [value]);
    return result?.changes || 0;
}
```

**问题**:

| 级别  | 问题描述                                        | 影响           |
| ----- | ----------------------------------------------- | -------------- |
| 🚨 P0 | **严重安全问题**：字段名和表名直接拼接到 SQL 中 | **SQL 注入**   |
| 🚨 P0 | table 和 field 没有转义                         | **数据库破坏** |
| ⚠️ P1 | 没有使用 SqlBuilder，代码不一致                 | 维护性差       |
| ⚠️ P1 | buildWhereClause 实现有问题（截取字符串）       | 逻辑错误       |
| ⚠️ P2 | 没有检查字段是否为数字类型                      | 运行时错误     |

**SQL 注入示例**:

```typescript
// 恶意调用
await increment('users; DROP TABLE users; --', 'balance', { id: 1 }, 100);

// 生成的 SQL
UPDATE users; DROP TABLE users; -- SET balance = balance + ? WHERE ...
```

**改进建议**:

1. **【必须】** 使用 SqlBuilder 构建 SQL，避免注入
2. **【必须】** 对表名和字段名进行转义（反引号）
3. 验证字段类型，防止对字符串字段自增
4. 添加边界检查（如不能减到负数）

---

### 14. buildWhereClause()

**功能**: 构建 WHERE 子句（私有方法）

**实现**:

```typescript
private buildWhereClause(where: WhereConditions): string {
    const builder = new SqlBuilder().where(where);
    const { sql } = builder.toSelectSql();
    const whereIndex = sql.indexOf('WHERE');
    return whereIndex > -1 ? sql.substring(whereIndex + 6) : '1=1';
}
```

**问题**:

| 级别  | 问题描述                                               | 影响          |
| ----- | ------------------------------------------------------ | ------------- |
| 🚨 P0 | **实现方式极其低效和不可靠**                           | 严重 Bug 隐患 |
| 🚨 P0 | 字符串截取不安全，如果 SQL 中包含 "WHERE" 字符串会误判 | **逻辑错误**  |
| ⚠️ P1 | 返回 "1=1" 作为默认值，不够明确                        | 语义不清      |

**问题示例**:

```typescript
// 如果 where 条件中包含字符串 "WHERE"
const where = { comment: 'This is WHERE clause' };
// 会被错误截取
```

**改进建议**:

1. **【必须】** 使用 SqlBuilder 的内部方法直接构建
2. 或提供 `SqlBuilder.toWhereClause()` 方法
3. 移除这个 hack 方法，使用正确的实现

---

## 问题汇总

### 🚨 P0 - 严重问题（必须立即修复）

| #   | 方法                | 问题                               | 影响             |
| --- | ------------------- | ---------------------------------- | ---------------- |
| 1   | increment/decrement | SQL 注入风险，表名和字段名直接拼接 | **数据库安全**   |
| 2   | getAll              | 没有上限保护，可能返回百万级数据   | **内存溢出**     |
| 3   | insDataBatch        | 逐条插入，性能极差（50-200 倍慢）  | **严重性能问题** |
| 4   | buildWhereClause    | 字符串截取实现不可靠               | **逻辑错误**     |

### ⚠️ P1 - 重要问题（应尽快修复）

| #   | 方法                 | 问题                           | 影响       |
| --- | -------------------- | ------------------------------ | ---------- |
| 1   | getList              | page/limit 没有上限校验        | 资源滥用   |
| 2   | processDataForInsert | 依赖 Redis，无降级方案         | 可用性差   |
| 3   | trans                | 依赖未实现的 transaction() API | 可能不可用 |
| 4   | insDataBatch         | 没有事务保护，部分成功部分失败 | 数据不一致 |

### 📝 P2 - 优化建议（可以改进）

| #   | 方法                  | 问题                      | 影响         |
| --- | --------------------- | ------------------------- | ------------ |
| 1   | addDefaultStateFilter | 可能覆盖用户的 state 条件 | 查询结果错误 |
| 2   | getDetail             | 没有 orderBy 参数         | 结果不可预测 |
| 3   | getList               | COUNT 查询在大表上慢      | 性能瓶颈     |
| 4   | updData               | 没有乐观锁支持            | 并发问题     |
| 5   | delData               | 软删除和物理删除混用      | 使用困惑     |
| 6   | exists                | 性能不佳                  | 资源浪费     |
| 7   | getFieldValue         | 字段名注入风险            | 安全风险     |

---

## 修复优先级

### 第一阶段（P0 - 必须立即修复）

**1. 修复 increment/decrement SQL 注入**

```typescript
// 修复前（危险）
const sql = `UPDATE ${table} SET ${field} = ${field} + ? WHERE ...`;

// 修复后（安全）
async increment(table: string, field: string, where: WhereConditions, value: number = 1): Promise<number> {
    const escapedTable = `\`${table}\``;
    const escapedField = `\`${field}\``;
    const builder = new SqlBuilder().where(where);
    const { sql: whereSql, params: whereParams } = builder.toSelectSql();
    const whereClause = whereSql.substring(whereSql.indexOf('WHERE') + 6);

    const sql = `UPDATE ${escapedTable} SET ${escapedField} = ${escapedField} + ? WHERE ${whereClause}`;
    const result = await this.executeWithConn(sql, [value, ...whereParams]);
    return result?.changes || 0;
}
```

**2. 给 getAll 添加上限保护**

```typescript
async getAll<T = any>(options: Omit<QueryOptions, 'page' | 'limit'>): Promise<T[]> {
    const MAX_LIMIT = 10000; // 硬性上限
    const WARNING_LIMIT = 1000; // 警告阈值

    const { table, fields = ['*'], where, orderBy, includeDeleted = false, customState } = options;

    const builder = new SqlBuilder()
        .select(fields)
        .from(table)
        .where(this.addDefaultStateFilter(where, includeDeleted, customState))
        .limit(MAX_LIMIT); // 强制添加上限

    if (orderBy) builder.orderBy(orderBy);

    const { sql, params } = builder.toSelectSql();
    const result = (await this.executeWithConn(sql, params)) || [];

    // 警告日志
    if (result.length >= WARNING_LIMIT) {
        console.warn(`getAll returned ${result.length} rows from table ${table}, consider using getList with pagination`);
    }

    return result;
}
```

**3. 重写 insDataBatch 为真正的批量插入**

```typescript
async insDataBatch(table: string, dataList: Record<string, any>[]): Promise<number[]> {
    if (dataList.length === 0) return [];

    const MAX_BATCH_SIZE = 1000;
    if (dataList.length > MAX_BATCH_SIZE) {
        throw new Error(`Batch size ${dataList.length} exceeds maximum ${MAX_BATCH_SIZE}`);
    }

    // 批量生成 ID
    const ids = await this.befly.redis.genTimeIDBatch(dataList.length);
    const now = Date.now();

    // 处理所有数据
    const processedList = dataList.map((data, index) => ({
        ...data,
        id: ids[index],
        created_at: now,
        updated_at: now,
        state: 1
    }));

    // 使用真正的批量插入
    const builder = new SqlBuilder();
    const { sql, params } = builder.toInsertSql(table, processedList);
    await this.executeWithConn(sql, params);

    return ids;
}
```

**4. 移除 buildWhereClause，使用正确实现**

```typescript
// 在 SqlBuilder 中添加方法
public toWhereClause(): { clause: string; params: any[] } {
    if (this._where.length === 0) {
        return { clause: '', params: [] };
    }
    return {
        clause: this._where.join(' AND '),
        params: [...this._params]
    };
}

// 在 SqlHelper 中使用
private buildWhereClause(where: WhereConditions): { clause: string; params: any[] } {
    const builder = new SqlBuilder().where(where);
    return builder.toWhereClause();
}
```

### 第二阶段（P1 - 尽快修复）

1. 添加 page/limit 上限校验
2. 提供 Redis 降级方案
3. 实现或明确 transaction() API
4. 为 insDataBatch 添加事务保护

### 第三阶段（P2 - 持续改进）

1. 优化各方法的性能
2. 统一错误处理方式
3. 添加日志记录
4. 完善文档说明

---

## 改进建议

### 1. 输入参数校验

```typescript
// 统一的参数校验函数
private validateParams(options: any): void {
    if (options.page !== undefined) {
        if (options.page < 1 || options.page > 10000) {
            throw new Error('Page must be between 1 and 10000');
        }
    }
    if (options.limit !== undefined) {
        if (options.limit < 1 || options.limit > 1000) {
            throw new Error('Limit must be between 1 and 1000');
        }
    }
}
```

### 2. 统一错误处理

```typescript
// 定义错误类型
class SqlHelperError extends Error {
    constructor(message: string, public code: string, public details?: any) {
        super(message);
        this.name = 'SqlHelperError';
    }
}

// 使用
throw new SqlHelperError('Insert failed', 'INSERT_ERROR', { table, data });
```

### 3. 添加日志记录

```typescript
async getList<T = any>(options: QueryOptions): Promise<ListResult<T>> {
    const startTime = Date.now();
    this.logger.debug('getList start', { table: options.table, page: options.page });

    // ... 执行查询 ...

    const duration = Date.now() - startTime;
    this.logger.info('getList complete', { table: options.table, duration, total });

    return result;
}
```

### 4. 性能监控

```typescript
// 添加慢查询警告
private async executeWithConn(sqlStr: string, params?: any[]): Promise<any> {
    const startTime = Date.now();
    const result = await this.sql.unsafe(sqlStr, params || []);
    const duration = Date.now() - startTime;

    if (duration > 1000) { // 超过 1 秒
        console.warn(`Slow query detected (${duration}ms): ${sqlStr.substring(0, 100)}`);
    }

    return result;
}
```

---

## 总结

### 当前状态

✅ **功能完整性**: 8/10
⚠️ **安全性**: 5/10
⚠️ **性能**: 6/10
⚠️ **可靠性**: 6/10
✅ **易用性**: 9/10

**总体评分**: 6.8/10

### 核心问题

1. **SQL 注入风险** - increment/decrement 方法存在严重安全隐患
2. **性能问题** - insDataBatch 逐条插入，getAll 无限制
3. **可靠性问题** - buildWhereClause 实现不可靠，trans 依赖未实现的 API

### 优先改进

1. **立即修复 P0 问题** - 安全性和稳定性
2. **尽快修复 P1 问题** - 可用性和性能
3. **持续改进 P2 问题** - 用户体验和代码质量

### 建议行动

1. 创建 issue 追踪所有问题
2. 按优先级制定修复计划
3. 编写测试用例覆盖所有方法
4. 更新文档，明确说明限制和注意事项
5. 发布修复版本，通知用户升级
