# 表定义（tables/\*.json）

本页只描述表定义 JSON 的**结构与约束**，以及它与 API 字段校验的关系。

## 表文件放哪里（扫描规则）

表定义来自：

- 项目：`<appDir>/tables/*.json`（只扫描这一层，不递归子目录）
- addon：`<addonRoot>/tables/*.json`（只扫描这一层，不递归子目录）

固定过滤：

- 忽略任何以下划线 `_` 开头的文件或目录（不可关闭、无例外）

说明：即使 `checkTable` 对文件名做了规则校验，被 `_` 过滤掉的文件/目录根本不会进入校验与同步流程。

## 表文件名规则

文件名必须是小驼峰（lowerCamelCase），例如：

- ✅ `userTable.json`
- ✅ `testCustomers.json`
- ❌ `user_table.json`

> 注意：文件名以 `_` 开头会被扫描阶段直接忽略，因此不会参与任何同步与校验。

## 表名/列名映射（与数据库实际表结构的关系）

### 表名如何生成

同步表结构（`syncTable`）时，会把“文件名”映射为数据库表名：

- 项目表 / core 表：`tableName = snakeCase(fileName)`
- addon 表：`tableName = "addon_" + snakeCase(addonName) + "_" + snakeCase(fileName)`

示例：

- 项目 `tables/userProfile.json` → 表 `user_profile`
- addon `admin` 的 `tables/role.json` → 表 `addon_admin_role`

### 字段 key 如何生成列名

表 JSON 里的字段 key 会被转为列名：

- `dbFieldName = snakeCase(colKey)`

例如 `userId` → `user_id`。

## 表 JSON 结构

一个表文件内容是一个对象：

- key：字段名（建议小驼峰）
- value：字段定义对象（FieldDefinition）

字段定义允许的属性：

- `name`（必填，中文标签）
- `type`（必填，数据库类型）
- `input`（可选，输入校验类型/规则，默认由 type 推导）
- `min` / `max`（可选，number 或 null）
- `default`（可选，JSON 值或 null）
- `detail`（可选，string）
- `precision`（可选，number 或 null，decimal 总位数）
- `scale`（可选，number 或 null，decimal 小数位数）
- `index`（可选，boolean）
- `unique`（可选，boolean）
- `nullable`（可选，boolean）
- `unsigned`（可选，boolean，仅整数类型有效，仅 MySQL 语义生效）

示例：

```json
{
    "email": {
        "name": "邮箱",
        "type": "varchar",
        "input": "@email",
        "max": 200,
        "nullable": false,
        "unique": true
    },
    "age": {
        "name": "年龄",
        "type": "bigint",
        "input": "number",
        "default": 0,
        "nullable": false,
        "unsigned": true
    },
    "bio": {
        "name": "简介",
        "type": "mediumtext",
        "input": "string",
        "default": null
    }
}
```

示例（完整业务表）：

```json
{
    "orderNo": {
        "name": "订单号",
        "type": "varchar",
        "input": "string",
        "max": 32,
        "nullable": false,
        "unique": true
    },
    "buyerId": {
        "name": "买家ID",
        "type": "bigint",
        "input": "integer",
        "default": 0,
        "nullable": false,
        "unsigned": true,
        "index": true
    },
    "amount": {
        "name": "订单金额",
        "type": "decimal",
        "input": "number",
        "precision": 12,
        "scale": 2,
        "default": 0,
        "nullable": false,
        "unsigned": true
    },
    "currency": {
        "name": "币种",
        "type": "char",
        "input": "string",
        "max": 3,
        "default": "CNY",
        "nullable": false
    },
    "status": {
        "name": "状态",
        "type": "varchar",
        "input": "pending|paid|cancel",
        "max": 16,
        "default": "pending",
        "nullable": false,
        "index": true
    },
    "createdAt": {
        "name": "创建时间",
        "type": "datetime",
        "default": null,
        "nullable": false,
        "index": true
    }
}
```

## 字段类型与关键约束（强约束）

允许的 `type`（数据库类型）：

- `tinyint`
- `smallint`
- `mediumint`
- `int`
- `bigint`
- `decimal`
- `char`
- `varchar`
- `tinytext`
- `text`
- `mediumtext`
- `longtext`
- `datetime`
- `json`

允许的 `input`（输入校验类型/规则）：

- `number`
- `integer`
- `string`
- `char`
- `array`
- `array_number`
- `array_integer`
- `json`
- `json_number`
- `json_integer`
- 或正则/枚举字符串（例如 `@email`、`^[a-z]+$`、`男|女`）

### 字段类型速查表（默认 input 推导）

| `type`                                  | 默认 `input` | 说明                                    |
| --------------------------------------- | ------------ | --------------------------------------- |
| `tinyint/smallint/mediumint/int/bigint` | `integer`    | 整数类，`unsigned` 可用                 |
| `decimal`                               | `number`     | 需 `precision/scale`，支持 `unsigned`   |
| `char/varchar`                          | `string`     | 需要 `max`，并受索引长度限制            |
| `tinytext/text/mediumtext/longtext`     | `string`     | 文本类，`min/max/default` 必须为 `null` |
| `datetime`                              | `string`     | 必须完整 `YYYY-MM-DD HH:mm:ss`          |
| `json`                                  | `json`       | 结构必须是对象或数组                    |

> 说明：显式提供 `input` 会覆盖默认推导；`input` 只影响校验，不影响 DDL。

关键约束（违反会阻断启动）：

- 保留字段不可出现在表定义中：`id`, `created_at`, `updated_at`, `deleted_at`, `state`
- `unique` 与 `index` 不能同时为 `true`
- `tinytext` / `text` / `mediumtext` / `longtext` / `json`：
    - `min/max` 必须为 `null`
    - `default` 必须为 `null`
    - 不支持 `index/unique`
- `char` / `varchar`：
    - 必须设置 `max:number`
    - 且 `max` 不能超过 16383（utf8mb4 下 VARCHAR 的字符长度上限近似值）
    - 当 `index=true` 时：要求 `max <= 500`
    - 当 `unique=true` 时：要求 `max <= 180`
    - 当 `input` 为 `array/array_number/array_integer` 时，`max` 表示“单个元素字符串长度”，不是数组长度
    - 当 `input=char` 时，`max` 必须为 1

- `decimal`：
    - 必须设置 `precision` 与 `scale`
    - `precision` 取值范围：1..65
    - `scale` 取值范围：0..30，且 `scale <= precision`
    - `default` 若存在，必须为 `number | null`
    - `unsigned` 可用（仅 MySQL 语义）

示例（索引字段：max 必须 <= 500）：

```json
{
    "title": {
        "name": "标题",
        "type": "varchar",
        "max": 200,
        "index": true
    }
}
```

示例（input 规则对比）：

```json
{
    "email": {
        "name": "邮箱",
        "type": "varchar",
        "input": "@email",
        "max": 200,
        "nullable": false
    },
    "age": {
        "name": "年龄",
        "type": "bigint",
        "input": "number",
        "default": 0,
        "nullable": false,
        "unsigned": true
    }
}
```

示例（decimal 精度/小数位）：

```json
{
    "price": {
        "name": "价格",
        "type": "decimal",
        "precision": 10,
        "scale": 2,
        "input": "number",
        "default": 0,
        "nullable": false
    }
}
```

示例（金额 + 比例型 decimal）：

```json
{
    "amount": {
        "name": "金额",
        "type": "decimal",
        "precision": 12,
        "scale": 2,
        "input": "number",
        "default": 0,
        "nullable": false,
        "unsigned": true
    },
    "rate": {
        "name": "税率",
        "type": "decimal",
        "precision": 5,
        "scale": 4,
        "input": "number",
        "default": 0,
        "nullable": false,
        "unsigned": true
    }
}
```

示例（正则/枚举 input）：

```json
{
    "phone": {
        "name": "手机号",
        "type": "varchar",
        "input": "@phone",
        "max": 20,
        "nullable": false
    },
    "gender": {
        "name": "性别",
        "type": "varchar",
        "input": "男|女",
        "max": 2,
        "nullable": false
    }
}
```

- `tinyint/smallint/mediumint/int/bigint`：`default` 若存在，必须为 `number | null`

- `datetime`：对应 MySQL `DATETIME`（到秒，等价 `DATETIME(0)`）
    - 输入值必须是字符串，且必须为完整格式：
        - `YYYY-MM-DD HH:mm:ss`
    - 会做“日期/时间合法性”校验（例如闰年、月份天数、时分秒范围），非法值会被判定为格式不正确
    - 空字符串会被视为“缺失值”（等同未传）
    - `min/max` 必须为 `null`
    - `default` 必须为 `null`
        - 说明：表定义的 `default` 是“表结构默认值”的概念；当前项目约定不在表定义里声明 datetime 的默认值。
        - 如需“默认当前时间”，请在业务写入时赋值（或通过触发器/SQL 脚本自行维护）。
    - 不允许设置 `unsigned`
    - `nullable/index/unique/input` 仍可用

示例：

```json
{
    "createdAt": {
        "name": "创建时间",
        "type": "datetime",
        "nullable": false,
        "index": true,
        "default": null
    },
    "expiresAt": {
        "name": "过期时间",
        "type": "datetime",
        "nullable": true,
        "default": null
    }
}
```

示例（数组输入字段落库）：

```json
{
    "tagIds": {
        "name": "标签ID",
        "type": "varchar",
        "input": "array_number",
        "max": 32,
        "default": "[]",
        "nullable": false
    }
}
```

示例（字符串数组 input=array）：

```json
{
    "tags": {
        "name": "标签",
        "type": "varchar",
        "input": "array",
        "max": 50,
        "default": "[]",
        "nullable": false
    }
}
```

示例（数组 + JSON 组合）：

```json
{
    "tagIds": {
        "name": "标签ID",
        "type": "varchar",
        "input": "array_number",
        "max": 32,
        "default": "[]",
        "nullable": false
    },
    "ext": {
        "name": "扩展信息",
        "type": "json",
        "input": "json",
        "default": null,
        "nullable": true
    }
}
```

示例（JSON input=json）：

```json
{
    "profile": {
        "name": "用户信息",
        "type": "json",
        "input": "json",
        "default": null,
        "nullable": true
    }
}
```

示例（JSON 数值校验）：

```json
{
    "scores": {
        "name": "评分",
        "type": "json",
        "input": "json_number",
        "default": null,
        "nullable": true
    },
    "points": {
        "name": "积分",
        "type": "json",
        "input": "json_integer",
        "default": null,
        "nullable": true
    }
}
```

提示：`type` 与 `input` 不匹配会导致校验语义偏离预期（例如 `type=json` 但 `input=string`），请保持一致。

> 注意：`syncTable` 不会自动执行 `DATETIME` 与 `BIGINT` 的互转（这属于“时间表示法迁移”，需要配套数据搬迁脚本手工处理）。

## 表定义与 API fields 的关系

在 API 文件中：

- `fields` 的结构与表定义一致（同样是 `TableDefinition`）
- 你可以：
    - 直接在 API 里内联写 fields
    - 或者从表定义（JSON）生成/复用规则（项目侧自行组织）

> 注意：本页只描述对外结构；表同步（syncTable）的行为请看 `database.md`/项目使用约定。
