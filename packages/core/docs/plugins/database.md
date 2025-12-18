# Befly 数据库操作指南

> 本文档详细介绍 Befly 框架的数据库操作 API，包括 CRUD 操作、事务、条件查询等。

## 目录

- [核心概念](#核心概念)
- [字段命名规范](#字段命名规范)
- [查询方法](#查询方法)
- [写入方法](#写入方法)
- [数值操作](#数值操作)
- [事务操作](#事务操作)
- [多表联查](#多表联查)
- [Where 条件语法](#where-条件语法)
- [字段选择语法](#字段选择语法)
- [排序语法](#排序语法)
- [系统字段说明](#系统字段说明)
- [完整示例](#完整示例)

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

---

## 字段命名规范

| 位置                  | 格式   | 示例                    |
| --------------------- | ------ | ----------------------- |
| 代码中（参数/返回值） | 小驼峰 | `userId`, `createdAt`   |
| 数据库中              | 下划线 | `user_id`, `created_at` |

---

## 查询方法

- `getOne`：查询单条
- `getList`：分页查询
- `getAll`：查询全部（有上限保护）
- `getCount`：查询数量
- `exists`：检查存在
- `getFieldValue`：查询单字段

---

## 写入方法

- `insData`：插入单条（自动生成系统字段）
- `insBatch`：批量插入
- `updData`：更新（自动更新 `updated_at`）
- `delData`：软删除
- `delForce`：硬删除
- `disableData` / `enableData`：禁用/启用

---

## 数值操作

- `increment`：自增
- `decrement`：自减

---

## 事务操作

使用 `trans` 方法执行事务，自动处理 commit/rollback。

---

## 多表联查

查询方法支持通过 `joins` 参数进行多表联查。

---

## Where 条件语法

支持 `$or/$and` 与 `$gt/$gte/$lt/$lte/$in/$between/$null/$like` 等。

---

## 字段选择语法

- `fields: []` / 不传：查询所有字段
- `fields: ["id", "name"]`：指定字段
- `fields: ["!password"]`：排除字段（不能混用包含与排除）

---

## 排序语法

使用 `字段#方向` 格式：`ASC` / `DESC`。

---

## 系统字段说明

每条记录自动包含：`id`、`created_at`、`updated_at`、`deleted_at`、`state`。

---

## 完整示例

更完整示例与细节说明请参考仓库中的 `DbHelper` 相关测试用例与源码实现。
