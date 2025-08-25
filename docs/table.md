# 表字段定义规范

## 概述

Befly 使用 JSON 定义字段规则，用于参数校验与数据库表结构同步。每条规则包含显示名、类型、范围、默认值、索引开关和正则约束等信息，并在同步脚本执行前通过检查器进行严格校验。

## 字段定义格式（7段，使用⚡分隔）

每个字段定义遵循以下格式：

"字段名": "显示名⚡类型⚡最小值⚡最大值⚡默认值⚡是否索引⚡正则约束"

注意：分隔符使用“⚡”，避免与正则表达式中的“|”冲突。

### 规则解析

字段定义由 7 个部分组成：

1. 显示名：中文或字母数字，不能包含空格、下划线、连字符等符号
2. 类型：string、number、text、array（小写）
3. 最小值：长度/数值下限，或 `null`
4. 最大值：长度/数值上限；string/array 类型必须为具体数字，其他类型可为数字或 `null`
5. 默认值：可为具体值或 `null`（text 类型即便设置了默认值也不会写入数据库默认值）
6. 是否索引：`1` 表示创建单列索引，`0` 表示不创建
7. 正则约束：用于校验的正则表达式字符串，或 `null`

## 支持的数据类型与示例

### 1. number（数字）

- 数据库类型：BIGINT
- 最小/最大表示数值范围
- 正则约束为正则表达式（不支持计算表达式）

示例：

{
"page": "页码⚡number⚡1⚡9999⚡1⚡0⚡null",
"enabled": "启用状态⚡number⚡0⚡1⚡1⚡0⚡^(0|1)$"
}

### 2. string（字符串）

- 数据库类型：VARCHAR
- 长度范围由最小/最大值控制；最大值必须为具体数字
- 支持正则校验

示例：

{
"email": "邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
  "phone": "手机号⚡string⚡11⚡11⚡null⚡1⚡^1[3-9]\\d{9}$",
"title": "标题⚡string⚡1⚡200⚡null⚡0⚡null"
}

### 3. text（长文本）

- 数据库类型：MEDIUMTEXT
- 支持长度范围与正则校验
- 数据库层不设置默认值（即使规则里填写了默认值）

示例：

{
"content": "内容⚡text⚡0⚡1000000⚡null⚡0⚡null"
}

### 4. array（数组）

- 数据库类型：VARCHAR（以 JSON 字符串形式存储）
- 最小/最大表示数组元素个数；最大值必须为具体数字
- 正则约束会逐个校验数组元素

示例：

{
"tag": "标签⚡array⚡0⚡10⚡[]⚡0⚡null"
}

## 正则约束说明

- 所有类型的第7段均使用正则表达式进行校验；不支持计算表达式
- number 类型会将数值转为字符串后用正则匹配
- array 类型会对每个元素逐一匹配正则

常用正则：

- 邮箱：`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$`
- 手机号：`^1[3-9]\\d{9}$`
- 日期：`^\\d{4}-\\d{2}-\\d{2}$`
- 日期时间：`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}`
- URL：`^https?://`
- 枚举：例如 `^(active|inactive|pending)$`

## 保留字段

以下字段为系统保留字段，不能在自定义表定义中使用（会由系统自动管理）：

- id - 主键ID
- created_at - 创建时间
- updated_at - 更新时间
- deleted_at - 删除时间
- state - 状态字段

## 校验规则（checks/table.js）

### 基本校验

1. 规则段数：必须包含 7 个部分，使用“⚡”分隔
2. 数据类型：必须为 string、number、text、array
3. 数值范围：最小/最大必须为 `null` 或数字；string/array 的最大值不可为 `null`
4. 默认值：必须为 `null`、字符串或数字
5. 索引位：仅允许 `0` 或 `1`
6. 正则：必须是有效正则或 `null`
7. 保留字段：JSON 的键名不可为 `id, created_at, updated_at, deleted_at, state`
8. 显示名限制：第1段显示名必须为中文或字母数字（不能含空格、下划线、连字符等）

### 表文件来源与同名限制

- 内核表定义目录：befly `tables/`
- 项目表定义目录：项目根目录下的 `tables/`
- 限制：项目 `tables/` 中的文件不允许与内核 `tables/` 同名（避免覆盖与歧义）。检查器会报错并中止。

### 运行时行为

- 同步脚本 `scripts/syncDb.js` 在执行前会先运行表规则检查（引入 `checks/table.js`），校验不通过将直接中断同步
- 同步时将创建/修改列，并依据第6段自动创建/删除单列索引（索引名：`idx_字段名`）

## 示例文件

### common.json（节选）

{
"email": "邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
  "phone": "手机号⚡string⚡11⚡11⚡null⚡1⚡^1[3-9]\\d{9}$",
"page": "页码⚡number⚡1⚡9999⚡1⚡0⚡null",
"limit": "每页数量⚡number⚡1⚡100⚡10⚡0⚡null",
"title": "标题⚡string⚡1⚡200⚡null⚡0⚡null",
"description": "描述⚡string⚡0⚡500⚡null⚡0⚡null",
"keyword": "关键词⚡string⚡1⚡50⚡null⚡1⚡null",
"status": "状态⚡string⚡1⚡20⚡active⚡1⚡^(active|inactive|pending|suspended)$",
  "enabled": "启用状态⚡number⚡0⚡1⚡1⚡0⚡^(0|1)$",
"date": "日期⚡string⚡10⚡10⚡null⚡0⚡^\\d{4}-\\d{2}-\\d{2}$",
"datetime": "日期时间⚡string⚡19⚡25⚡null⚡0⚡^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}",
"filename": "文件名⚡string⚡1⚡255⚡null⚡0⚡null",
"url": "网址⚡string⚡5⚡500⚡null⚡0⚡^https?://",
"tag": "标签⚡array⚡0⚡10⚡[]⚡0⚡null"
}

### tool.json

{
"filename": "文件名⚡string⚡1⚡255⚡null⚡1⚡null",
"content": "内容⚡string⚡0⚡1000000⚡null⚡0⚡null",
"type": "类型⚡string⚡0⚡50⚡file⚡1⚡^(file|folder|link)$",
"path": "路径⚡string⚡1⚡500⚡null⚡0⚡null"
}

## 字段变更检测（scripts/syncDb.js）

同步工具支持检测现有数据库字段的变更，并自动应用更新：

### 支持的变更类型

1. 字段长度变更
    - 检测 string/array 的最大长度变化
    - 自动生成 `ALTER TABLE ... MODIFY COLUMN` 语句
2. 字段注释变更
    - 检测第1段显示名变更并同步到 COMMENT
3. 数据类型变更
    - 自动转换到目标数据库类型（number→BIGINT，string→VARCHAR，text→MEDIUMTEXT，array→VARCHAR）

### 变更检测流程

1. 读取表定义文件
2. 查询现有数据库表结构
3. 逐字段比较差异
4. 生成对应的 ALTER 语句
5. 执行数据库结构更新
6. 记录变更日志

### 示例场景

- 字段长度扩展：

ALTER TABLE `users` MODIFY COLUMN `username` VARCHAR(100) COMMENT "用户名"

- 类型升级：

ALTER TABLE `products` MODIFY COLUMN `description` MEDIUMTEXT COMMENT "描述"

- 注释更新：

ALTER TABLE `orders` MODIFY COLUMN `status` VARCHAR(20) COMMENT "订单状态"

## 安全保护

- 保留字段保护：系统字段不会被修改
- 渐进式更新：只修改有变化的字段
- 日志记录：详细记录所有变更操作
- 回滚建议：生产环境操作前做好备份

## 数据库字段类型对应关系

| 数据类型 | 数据库字段类型 | 说明                             |
| -------- | -------------- | -------------------------------- |
| number   | BIGINT         | 大整数类型                       |
| string   | VARCHAR        | 可变长度字符串（需指定最大长度） |
| text     | MEDIUMTEXT     | 中等长度文本                     |
| array    | VARCHAR        | JSON 字符串存储的数组            |

## 默认值与索引行为（数据库层）

- text：不设置默认值
- string/array：当第5段为 `null` 时，默认值为空串 ""
- number：当第5段为 `null` 时，默认值为 0
- 自动索引：创建表时附带 `idx_created_at`、`idx_updated_at`、`idx_state`；字段规则第6段为 `1` 时创建 `idx_字段名`

## 工具与运行

- 表规则检查（需要 Bun）：

```bash
bun run checks/table.js
```

- 同步数据库表结构（仅支持 MySQL 8.0+）：

```bash
bun run scripts/syncDb.js
```

## 常见错误

1. 规则分隔错误：未使用“⚡”或段数不是 7
2. 类型错误：不在 string/number/text/array 范围，或大小写不正确
3. 数值错误：最小/最大不是数字或 `null`；string/array 的最大值为 `null`
4. 正则错误：第7段不是有效正则
5. 保留字段：使用了 id/created_at/updated_at/deleted_at/state 作为字段名
6. 显示名非法：包含空格、下划线、连字符等

## 最佳实践

- 使用有意义的字段名，避免保留字段名
- 合理设置长度/范围，防止异常数据
- 简明的正则表达式，注意转义
- 字段需要搜索/关联时将第6段置为 `1` 创建索引
- 文档与定义保持同步，更新后先本地运行检查与同步脚本
