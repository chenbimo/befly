# 表结构定义指南

> 本文档详细介绍 Befly 框架的表结构定义规范，包括字段类型、约束、校验规则及数据库同步机制。

## 目录

- [表结构定义指南](#表结构定义指南)
    - [目录](#目录)
    - [核心概念](#核心概念)
        - [表定义文件](#表定义文件)
        - [文件存放位置](#文件存放位置)
        - [表名生成规则](#表名生成规则)
    - [字段定义](#字段定义)
        - [完整字段结构](#完整字段结构)
        - [必填属性](#必填属性)
        - [可选属性](#可选属性)
    - [字段类型](#字段类型)
        - [string - 字符串](#string---字符串)
        - [number - 数字](#number---数字)
        - [text - 长文本](#text---长文本)
        - [array_string - 字符串数组](#array_string---字符串数组)
        - [array_text - 长文本数组](#array_text---长文本数组)
        - [类型映射表](#类型映射表)
    - [约束与索引](#约束与索引)
        - [index - 普通索引](#index---普通索引)
        - [unique - 唯一约束](#unique---唯一约束)
        - [nullable - 可空约束](#nullable---可空约束)
        - [unsigned - 无符号约束](#unsigned---无符号约束)
    - [正则验证](#正则验证)
        - [内置正则](#内置正则)
        - [自定义正则](#自定义正则)
    - [系统字段](#系统字段)
        - [保留字段列表](#保留字段列表)
        - [State 状态值](#state-状态值)
    - [校验规则](#校验规则)
        - [文件名规范](#文件名规范)
        - [字段名规范](#字段名规范)
        - [类型联动校验](#类型联动校验)
    - [数据库同步](#数据库同步)
        - [同步命令](#同步命令)
        - [同步流程](#同步流程)
        - [变更检测](#变更检测)
        - [安全机制](#安全机制)
    - [完整示例](#完整示例)
        - [用户表定义](#用户表定义)
        - [角色表定义](#角色表定义)
        - [文章表定义](#文章表定义)
    - [最佳实践](#最佳实践)

---

## 核心概念

### 表定义文件

Befly 使用 JSON 文件定义数据库表结构。每个 JSON 文件对应一张数据库表，文件中的每个键值对定义一个字段。

```json
{
    "fieldKey": {
        "name": "字段标签",
        "type": "string",
        "max": 100
    }
}
```

### 文件存放位置

| 类型     | 目录位置                       | 表名前缀              |
| -------- | ------------------------------ | --------------------- |
| 项目表   | `项目根目录/tables/`           | 无前缀                |
| Addon 表 | `packages/addon{Name}/tables/` | `addon_{addon_name}_` |

### 表名生成规则

表名由文件名自动转换生成：

```
文件名（小驼峰）  →  数据库表名（下划线）

userProfile.json  →  user_profile          # 项目表
admin.json        →  addon_admin_admin     # addonAdmin 的表
loginLog.json     →  addon_admin_login_log # addonAdmin 的表
```

---

## 字段定义

### 完整字段结构

```typescript
interface FieldDefinition {
    /** 字段标签/描述（必填） */
    name: string;
    /** 字段类型（必填） */
    type: "string" | "number" | "text" | "array_string" | "array_text";
    /** 字段详细说明 */
    detail?: string;
    /** 最小值/最小长度 */
    min?: number | null;
    /** 最大值/最大长度 */
    max?: number | null;
    /** 默认值 */
    default?: any;
    /** 是否创建索引 */
    index?: boolean;
    /** 是否唯一 */
    unique?: boolean;
    /** 是否允许为空 */
    nullable?: boolean;
    /** 是否无符号（仅 number 类型） */
    unsigned?: boolean;
    /** 正则验证 */
    regexp?: string | null;
}
```

### 必填属性

| 属性   | 类型     | 说明                                                                           |
| ------ | -------- | ------------------------------------------------------------------------------ |
| `name` | `string` | 字段标签，用于 API 返回和错误提示，支持中文、字母、数字、空格、下划线、短横线  |
| `type` | `string` | 字段类型，必须为 `string`、`number`、`text`、`array_string`、`array_text` 之一 |

### 可选属性

| 属性       | 类型             | 默认值                                          | 说明                                                                     |
| ---------- | ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `detail`   | `string`         | `''`                                            | 字段详细说明                                                             |
| `min`      | `number \| null` | `0`                                             | 最小值（number）或最小长度（string）                                     |
| `max`      | `number \| null` | `100` (string) <br> `9999999999999999` (number) | 最大值（number）或最大长度（string），number 类型默认为 9999999999999999 |
| `default`  | `any`            | `null`                                          | 默认值                                                                   |
| `index`    | `boolean`        | `false`                                         | 是否创建普通索引                                                         |
| `unique`   | `boolean`        | `false`                                         | 是否唯一约束                                                             |
| `nullable` | `boolean`        | `false`                                         | 是否允许 NULL                                                            |
| `unsigned` | `boolean`        | `true`                                          | 是否无符号（仅 number 类型有效）                                         |
| `regexp`   | `string \| null` | `null`                                          | 正则验证规则（内置或自定义）                                             |

---

## 字段类型

### string - 字符串

用于存储定长或短文本，映射到数据库 `VARCHAR` 类型。

```json
{
    "username": {
        "name": "用户名",
        "type": "string",
        "min": 2,
        "max": 30,
        "regexp": "@alphanumeric_"
    },
    "email": {
        "name": "邮箱",
        "type": "string",
        "max": 100,
        "default": "",
        "regexp": "@email"
    }
}
```

**约束规则：**

- `max` 必须为数字，范围 1 ~ 65535
- `min` 用于输入验证，不影响数据库结构
- 默认值为空字符串 `''`

### number - 数字

用于存储整数，映射到数据库 `BIGINT` 类型。

```json
{
    "age": {
        "name": "年龄",
        "type": "number",
        "min": 0,
        "max": 150,
        "default": 0
    },
    "userId": {
        "name": "用户ID",
        "type": "number",
        "min": 1,
        "index": true
    }
}
```

**约束规则：**

- `min` 和 `max` 用于输入验证
- `max` 默认为 `9999999999999999`（如未指定或为 null）
- `unsigned` 默认为 `true`（无符号，仅 MySQL 有效）
- 默认值为 `0`

### text - 长文本

用于存储大段文本，映射到数据库 `MEDIUMTEXT`（MySQL）或 `TEXT`（PostgreSQL）。

```json
{
    "content": {
        "name": "文章内容",
        "type": "text"
    },
    "description": {
        "name": "描述",
        "type": "text",
        "nullable": true
    }
}
```

**约束规则：**

- `min` 和 `max` 必须为 `null`（不限制长度）
- `default` 必须为 `null`（MySQL TEXT 不支持默认值）
- 不支持创建索引

### array_string - 字符串数组

用于存储字符串数组，以 JSON 格式存入 `VARCHAR` 字段。

```json
{
    "tags": {
        "name": "标签",
        "type": "array_string",
        "max": 500
    }
}
```

**约束规则：**

- `max` 指定存储 JSON 字符串的最大长度
- 默认值为 `'[]'`（空数组 JSON）
- 存储格式：`["tag1", "tag2", "tag3"]`

### array_text - 长文本数组

用于存储大型数组数据，以 JSON 格式存入 `MEDIUMTEXT` 字段。

```json
{
    "menus": {
        "name": "菜单权限",
        "type": "array_text"
    },
    "apis": {
        "name": "接口权限",
        "type": "array_text"
    }
}
```

**约束规则：**

- `min` 和 `max` 必须为 `null`
- `default` 必须为 `null`
- 存储格式：JSON 数组字符串

### 类型映射表

| Befly 类型     | MySQL          | PostgreSQL          | SQLite    |
| -------------- | -------------- | ------------------- | --------- |
| `string`       | `VARCHAR(max)` | `character varying` | `TEXT`    |
| `number`       | `BIGINT`       | `BIGINT`            | `INTEGER` |
| `text`         | `MEDIUMTEXT`   | `TEXT`              | `TEXT`    |
| `array_string` | `VARCHAR(max)` | `character varying` | `TEXT`    |
| `array_text`   | `MEDIUMTEXT`   | `TEXT`              | `TEXT`    |

---

## 约束与索引

### index - 普通索引

为字段创建普通索引，加速查询。

```json
{
    "categoryId": {
        "name": "分类ID",
        "type": "number",
        "index": true
    },
    "status": {
        "name": "状态",
        "type": "string",
        "max": 20,
        "index": true
    }
}
```

**生成的索引名：** `idx_{字段名}`

### unique - 唯一约束

确保字段值在表中唯一。

```json
{
    "username": {
        "name": "用户名",
        "type": "string",
        "max": 30,
        "unique": true
    },
    "email": {
        "name": "邮箱",
        "type": "string",
        "max": 100,
        "unique": true
    }
}
```

### nullable - 可空约束

允许字段存储 NULL 值。

```json
{
    "deletedAt": {
        "name": "删除时间",
        "type": "number",
        "nullable": true
    },
    "remark": {
        "name": "备注",
        "type": "string",
        "max": 500,
        "nullable": true
    }
}
```

**注意：** 默认 `nullable: false`，字段不允许为 NULL。

### unsigned - 无符号约束

仅对 `number` 类型有效，仅 MySQL 支持。

```json
{
    "amount": {
        "name": "金额",
        "type": "number",
        "unsigned": true
    },
    "balance": {
        "name": "余额（可负）",
        "type": "number",
        "unsigned": false
    }
}
```

**注意：** 默认 `unsigned: true`。

---

## 正则验证

### 内置正则

使用 `@` 前缀引用内置正则规则：

| 规则名               | 说明                       | 示例               |
| -------------------- | -------------------------- | ------------------ |
| `@email`             | 邮箱格式                   | `user@example.com` |
| `@phone`             | 手机号（中国）             | `13800138000`      |
| `@alphanumeric`      | 字母和数字                 | `abc123`           |
| `@alphanumeric_`     | 字母、数字、下划线         | `user_123`         |
| `@alphanumericDash_` | 字母、数字、下划线、短横线 | `role-code_123`    |

```json
{
    "email": {
        "name": "邮箱",
        "type": "string",
        "max": 100,
        "regexp": "@email"
    },
    "username": {
        "name": "用户名",
        "type": "string",
        "max": 30,
        "regexp": "@alphanumeric_"
    }
}
```

### 自定义正则

直接使用正则表达式字符串：

```json
{
    "roleType": {
        "name": "角色类型",
        "type": "string",
        "max": 5,
        "regexp": "^(admin|user)$"
    },
    "code": {
        "name": "编码",
        "type": "string",
        "max": 20,
        "regexp": "^[A-Z]{2}[0-9]{4}$"
    }
}
```

---

## 系统字段

### 保留字段列表

以下字段由系统自动创建和管理，**不能**在表定义中使用：

| 字段名       | 类型      | 说明                     |
| ------------ | --------- | ------------------------ |
| `id`         | `BIGINT`  | 主键 ID，自增            |
| `created_at` | `BIGINT`  | 创建时间戳（毫秒）       |
| `updated_at` | `BIGINT`  | 更新时间戳（毫秒）       |
| `deleted_at` | `BIGINT`  | 删除时间戳（软删除标记） |
| `state`      | `TINYINT` | 状态字段                 |

**系统自动创建的索引：**

- `idx_created_at`
- `idx_updated_at`
- `idx_state`

### State 状态值

| 值  | 常量名     | 说明      |
| --- | ---------- | --------- |
| `0` | `DISABLED` | 禁用      |
| `1` | `ENABLED`  | 正常/启用 |
| `2` | `DELETED`  | 已删除    |

---

## 校验规则

### 文件名规范

表定义文件必须使用**小驼峰命名**：

```
✓ user.json
✓ userProfile.json
✓ loginLog.json

✗ User.json          # 首字母大写
✗ user_profile.json  # 下划线
✗ user-profile.json  # 短横线
```

特殊文件（以下划线开头）用于通用字段定义：

```
✓ _common.json       # 通用字段定义
```

### 字段名规范

字段标签（`name` 属性）支持：

- 中文字符
- 英文字母
- 数字
- 空格
- 下划线 `_`
- 短横线 `-`

```json
{
    "field1": { "name": "用户名称" }, // ✓
    "field2": { "name": "User Name" }, // ✓
    "field3": { "name": "用户-名称_123" } // ✓
}
```

### 类型联动校验

不同字段类型有特定的约束规则：

| 类型           | min/max 要求     | default 要求         |
| -------------- | ---------------- | -------------------- |
| `string`       | `max` 必须为数字 | 可为任意字符串       |
| `number`       | 可为数字         | 必须为 `null` 或数字 |
| `text`         | 必须为 `null`    | 必须为 `null`        |
| `array_string` | `max` 必须为数字 | 默认为 `'[]'`        |
| `array_text`   | 必须为 `null`    | 必须为 `null`        |

---

## 数据库同步

### 触发方式

服务启动时会在**主进程**自动执行 `syncTable()`。

如需在代码中手动触发：

```typescript
import { syncTable } from "../../sync/syncTable.js";
import { scanSources } from "../../utils/scanSources.js";

// ctx：BeflyContext（需已具备 ctx.db / ctx.redis / ctx.config）
const sources = await scanSources();
await syncTable(ctx, sources.tables);
```

### 同步流程

```
1. 校验表定义文件（checkTable）
   ├─ 文件名格式校验
   ├─ 字段类型校验
   ├─ 约束规则校验
   └─ 保留字段检查

2. 建立数据库连接
   └─ 检查数据库版本（MySQL 8+, PostgreSQL 17+）

3. 扫描表定义文件
   ├─ 项目 tables 目录
   └─ 各 addon 的 tables 目录

4. 对比并应用变更
   ├─ 表不存在 → 创建表
   └─ 表已存在 → 对比字段变化
       ├─ 新增字段 → ADD COLUMN
       ├─ 修改字段 → MODIFY COLUMN
       └─ 索引变更 → CREATE/DROP INDEX

5. 清理 Redis 缓存
```

### 变更检测

同步时检测以下变更：

| 变更类型 | 说明                         | 自动执行             |
| -------- | ---------------------------- | -------------------- |
| 长度扩展 | VARCHAR 长度增加             | ✓                    |
| 长度收缩 | VARCHAR 长度减少             | ✗ 跳过（需手动处理） |
| 类型宽化 | INT → BIGINT, VARCHAR → TEXT | ✓                    |
| 类型变更 | 其他类型变更                 | ✗ 禁止               |
| 默认值   | 默认值变更                   | ✓                    |
| 注释     | 字段注释变更                 | ✓                    |
| 索引     | 添加/删除索引                | ✓                    |

### 安全机制

1. **禁止危险类型变更**：不允许从 `BIGINT` 改为 `VARCHAR` 等不兼容变更
2. **长度收缩保护**：默认跳过长度收缩，避免数据截断
3. **保留字段保护**：不允许定义系统保留字段

---

## 完整示例

### 用户表定义

```json
// tables/user.json
{
    "nickname": {
        "name": "昵称",
        "type": "string",
        "min": 1,
        "max": 50
    },
    "username": {
        "name": "用户名",
        "type": "string",
        "min": 2,
        "max": 30,
        "unique": true,
        "regexp": "@alphanumeric_"
    },
    "password": {
        "name": "密码",
        "type": "string",
        "min": 6,
        "max": 500
    },
    "email": {
        "name": "邮箱",
        "type": "string",
        "max": 100,
        "unique": true,
        "regexp": "@email"
    },
    "phone": {
        "name": "手机号",
        "type": "string",
        "max": 20,
        "regexp": "@phone"
    },
    "avatar": {
        "name": "头像",
        "type": "string",
        "max": 500
    },
    "departmentId": {
        "name": "部门ID",
        "type": "number",
        "min": 1,
        "index": true
    },
    "lastLoginTime": {
        "name": "最后登录时间",
        "type": "number",
        "default": 0
    },
    "lastLoginIp": {
        "name": "最后登录IP",
        "type": "string",
        "max": 50
    }
}
```

### 角色表定义

```json
// tables/role.json
{
    "name": {
        "name": "角色名称",
        "type": "string",
        "min": 2,
        "max": 50,
        "index": true
    },
    "code": {
        "name": "角色编码",
        "type": "string",
        "min": 2,
        "max": 50,
        "unique": true,
        "regexp": "@alphanumericDash_"
    },
    "description": {
        "name": "角色描述",
        "type": "string",
        "max": 200
    },
    "menus": {
        "name": "菜单权限",
        "type": "array_text"
    },
    "apis": {
        "name": "接口权限",
        "type": "array_text"
    },
    "sort": {
        "name": "排序",
        "type": "number",
        "default": 0
    }
}
```

### 文章表定义

```json
// tables/article.json
{
    "title": {
        "name": "标题",
        "type": "string",
        "min": 1,
        "max": 200,
        "index": true
    },
    "summary": {
        "name": "摘要",
        "type": "string",
        "max": 500
    },
    "content": {
        "name": "内容",
        "type": "text"
    },
    "authorId": {
        "name": "作者ID",
        "type": "number",
        "index": true
    },
    "categoryId": {
        "name": "分类ID",
        "type": "number",
        "index": true
    },
    "tags": {
        "name": "标签",
        "type": "array_string",
        "max": 500
    },
    "viewCount": {
        "name": "阅读数",
        "type": "number",
        "default": 0
    },
    "publishedAt": {
        "name": "发布时间",
        "type": "number",
        "default": 0,
        "index": true
    }
}
```

---

## 最佳实践

1. **合理选择字段类型**
    - 短文本（< 65535 字符）使用 `string`
    - 长文本（文章、JSON 大对象）使用 `text`
    - ID、时间戳、数值使用 `number`

2. **设置合理的长度限制**
    - 用户名：30 ~ 50
    - 邮箱：100 ~ 150
    - URL/路径：500 ~ 1000
    - 标题：100 ~ 200

3. **善用索引**
    - 经常作为查询条件的字段添加 `index: true`
    - 需要唯一性的字段使用 `unique: true`
    - 避免对长文本字段创建索引

4. **使用正则验证**
    - 用户输入使用内置正则（`@email`、`@phone` 等）
    - 枚举值使用自定义正则（`^(a|b|c)$`）

5. **默认值设计**
    - 数值字段默认为 `0`
    - 字符串字段默认为 `''`
    - 时间戳字段默认为 `0`

6. **文件组织**
    - 一张表对应一个 JSON 文件
    - 文件名使用小驼峰
    - 相关表放在同一目录
