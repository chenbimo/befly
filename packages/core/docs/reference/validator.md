# Validator 参数验证

> 请求参数验证与类型转换

## 目录

- [概述](#概述)
- [验证器类](#验证器类)
- [验证规则](#验证规则)
- [类型转换](#类型转换)
- [正则别名](#正则别名)
- [验证钩子](#验证钩子)
- [API 字段定义](#api-字段定义)
- [验证结果](#验证结果)
- [使用示例](#使用示例)
- [FAQ](#faq)

---

## 概述

Validator 是 Befly 的参数验证系统，提供：

- **数据验证**：根据字段定义验证数据
- **类型转换**：自动转换为目标类型
- **规则检查**：长度、范围、正则等
- **钩子集成**：自动验证 API 请求参数

---

## 验证器类

### 基本结构

```typescript
import { Validator } from "../lib/validator.ts";

class Validator {
    // 验证数据对象
    static validate(data: Record<string, any>, rules: TableDefinition, required: string[]): ValidateResult;

    // 验证单个值（带类型转换）
    static single(value: any, fieldDef: FieldDefinition): SingleResult;
}
```

### validate 方法

批量验证数据对象：

```typescript
const data = {
    email: "test@example.com",
    age: 25,
    name: "John"
};

const rules = {
    email: { name: "邮箱", type: "string", min: 5, max: 100, regexp: "@email" },
    age: { name: "年龄", type: "number", min: 0, max: 150 },
    name: { name: "姓名", type: "string", min: 2, max: 50 }
};

const result = Validator.validate(data, rules, ["email", "name"]);

if (result.failed) {
    console.log(result.firstError); // 第一条错误信息
    console.log(result.errors); // 所有错误信息
    console.log(result.errorFields); // 出错字段列表
    console.log(result.fieldErrors); // 字段->错误映射
}
```

### single 方法

验证单个值并进行类型转换：

```typescript
const fieldDef = {
    name: "年龄",
    type: "number",
    min: 0,
    max: 150,
    default: 0
};

const result = Validator.single("25", fieldDef);

if (!result.error) {
    console.log(result.value); // 25 (已转换为 number)
} else {
    console.log(result.error); // 错误信息
}
```

---

## 验证规则

### 字段定义格式

字段定义包含以下属性：

| 属性       | 类型    | 必填 | 说明                     |
| ---------- | ------- | ---- | ------------------------ |
| `name`     | string  | 是   | 字段标签（用于错误提示） |
| `type`     | string  | 是   | 数据类型                 |
| `min`      | number  | 否   | 最小值/长度              |
| `max`      | number  | 否   | 最大值/长度              |
| `default`  | any     | 否   | 默认值                   |
| `regexp`   | string  | 否   | 正则表达式或别名         |
| `required` | boolean | 否   | 是否必填                 |

### 支持的类型

| 类型           | 说明       | min/max 含义 |
| -------------- | ---------- | ------------ |
| `string`       | 字符串     | 字符长度     |
| `text`         | 长文本     | 字符长度     |
| `number`       | 数字       | 数值范围     |
| `array_string` | 字符串数组 | 元素数量     |
| `array_text`   | 文本数组   | 元素数量     |

### 验证逻辑

```
┌─────────────────────────────────────────────────────┐
│                   验证流程                          │
├─────────────────────────────────────────────────────┤
│  1. 参数检查                                        │
│     └── 确保 data 和 rules 是有效对象               │
│         ↓                                           │
│  2. 必填字段检查                                    │
│     └── 检查 required 数组中的字段是否有值          │
│         ↓                                           │
│  3. 类型转换                                        │
│     └── 将值转换为目标类型                          │
│         ↓                                           │
│  4. 规则验证                                        │
│     ├── 数字：检查 min/max 范围                     │
│     ├── 字符串：检查长度 min/max                    │
│     ├── 数组：检查元素数量                          │
│     └── 正则：检查格式是否匹配                      │
│         ↓                                           │
│  5. 构建结果                                        │
│     └── 返回 ValidateResult 对象                   │
└─────────────────────────────────────────────────────┘
```

---

## 类型转换

### 转换规则

| 目标类型       | 输入         | 输出         |
| -------------- | ------------ | ------------ |
| `number`       | `"123"`      | `123`        |
| `number`       | `123`        | `123`        |
| `number`       | `"abc"`      | **错误**     |
| `string`       | `"hello"`    | `"hello"`    |
| `string`       | `123`        | **错误**     |
| `array_string` | `["a", "b"]` | `["a", "b"]` |
| `array_string` | `"abc"`      | **错误**     |

### 空值处理

空值（`undefined`、`null`、`""`）时返回默认值：

```typescript
// 有 default 属性时使用 default
{ type: 'number', default: 10 }   → 10
{ type: 'string', default: '默认' } → '默认'

// 无 default 时使用类型默认值
{ type: 'number' }       → 0
{ type: 'string' }       → ''
{ type: 'array_string' } → []
```

### 数组默认值

数组类型的默认值可以是字符串格式：

```typescript
// 字符串格式的数组默认值
{ type: 'array_string', default: '[]' }           → []
{ type: 'array_string', default: '["a","b"]' }    → ['a', 'b']
```

---

## 正则别名

### 使用方式

正则可以使用别名（以 `@` 开头）或直接写正则表达式：

```typescript
// 使用别名
{
    regexp: "@email";
} // 邮箱格式
{
    regexp: "@phone";
} // 手机号格式
{
    regexp: "@url";
} // URL 格式

// 直接使用正则
{
    regexp: "^[a-z]+$";
} // 小写字母
```

### 内置别名

| 别名        | 说明            | 正则                     |
| ----------- | --------------- | ------------------------ | -------- | ----- |
| `@number`   | 正整数          | `^\d+$`                  |
| `@integer`  | 整数（含负数）  | `^-?\d+$`                |
| `@float`    | 浮点数          | `^-?\d+(\.\d+)?$`        |
| `@positive` | 正整数（不含0） | `^[1-9]\d*$`             |
| `@email`    | 邮箱            | `^[a-zA-Z0-9._%+-]+@...` |
| `@phone`    | 手机号          | `^1[3-9]\d{9}$`          |
| `@url`      | URL             | `^https?://`             |
| `@ip`       | IPv4            | `^((25[0-5]              | 2[0-4]\d | ...)` |
| `@uuid`     | UUID            | `^[0-9a-f]{8}-...`       |
| `@date`     | 日期            | `^\d{4}-\d{2}-\d{2}$`    |
| `@time`     | 时间            | `^\d{2}:\d{2}:\d{2}$`    |
| `@datetime` | 日期时间        | `^\d{4}-\d{2}-\d{2}T...` |

### 完整别名列表

**数字类**：

- `@number` - 正整数
- `@integer` - 整数（含负数）
- `@float` - 浮点数
- `@positive` - 正整数（不含0）
- `@negative` - 负整数
- `@zero` - 零

**字符类**：

- `@word` - 纯字母
- `@alphanumeric` - 字母和数字
- `@alphanumeric_` - 字母、数字和下划线
- `@lowercase` - 小写字母
- `@uppercase` - 大写字母
- `@chinese` - 纯中文
- `@chineseWord` - 中文和字母

**网络类**：

- `@email` - 邮箱
- `@url` - URL
- `@ip` - IPv4
- `@ipv6` - IPv6
- `@domain` - 域名

**编码类**：

- `@uuid` - UUID
- `@hex` - 十六进制
- `@base64` - Base64
- `@md5` - MD5
- `@sha1` - SHA1
- `@sha256` - SHA256

**日期时间**：

- `@date` - 日期 YYYY-MM-DD
- `@time` - 时间 HH:MM:SS
- `@datetime` - ISO 日期时间
- `@year` - 年份
- `@month` - 月份
- `@day` - 日期

**标识符**：

- `@variable` - 变量名
- `@constant` - 常量名
- `@package` - 包名
- `@username` - 用户名
- `@nickname` - 昵称

**账号类**：

- `@phone` - 手机号
- `@telephone` - 固定电话
- `@idCard` - 身份证号
- `@bankCard` - 银行卡号
- `@qq` - QQ号
- `@wechat` - 微信号

**密码类**：

- `@passwordWeak` - 弱密码（6位以上）
- `@passwordMedium` - 中等密码（8位，含字母数字）
- `@passwordStrong` - 强密码（8位，含大小写、数字、特殊字符）

---

## 验证钩子

### 自动验证

Validator Hook 自动验证 API 请求参数：

```typescript
// hooks/validator.ts
const hook: Hook = {
    order: 6, // 在 parser 之后执行
    handler: async (befly, ctx) => {
        if (!ctx.api?.fields) return;

        const result = Validator.validate(ctx.body, ctx.api.fields, ctx.api.required || []);

        if (result.code !== 0) {
            ctx.response = ErrorResponse(ctx, result.firstError || "参数验证失败", 1, null, result.fieldErrors);
        }
    }
};
```

### 执行顺序

```
请求 → parser (解析) → validator (验证) → API handler
                              ↓
                        验证失败则返回错误响应
```

---

## API 字段定义

### 在 API 中定义字段

```typescript
// apis/user/login.ts
export default {
    name: "用户登录",
    method: "POST",
    auth: false,
    fields: {
        email: { name: "邮箱", type: "string", min: 5, max: 100, regexp: "@email" },
        password: { name: "密码", type: "string", min: 6, max: 100 }
    },
    required: ["email", "password"],
    handler: async (befly, ctx) => {
        // ctx.body.email 和 ctx.body.password 已验证
        return Yes("登录成功");
    }
} as ApiRoute;
```

### 引用表字段

可以引用表定义中的字段：

```typescript
import { adminTable } from "../../../tables/admin.ts";

export default {
    name: "创建管理员",
    fields: {
        email: adminTable.email, // 引用表字段
        password: adminTable.password,
        nickname: adminTable.nickname
    },
    required: ["email", "password"],
    handler: async (befly, ctx) => {
        // ...
    }
} as ApiRoute;
```

### 使用公共字段

```typescript
import { Fields } from "../../../config/fields.ts";

export default {
    name: "获取列表",
    fields: {
        ...Fields.page, // 分页字段
        ...Fields.limit,
        keyword: { name: "关键词", type: "string", max: 50 }
    },
    handler: async (befly, ctx) => {
        // ...
    }
} as ApiRoute;
```

---

## 验证结果

### ValidateResult 结构

```typescript
interface ValidateResult {
    code: number; // 0=成功，1=失败
    failed: boolean; // 是否失败
    firstError: string | null; // 第一条错误信息
    errors: string[]; // 所有错误信息
    errorFields: string[]; // 出错字段名列表
    fieldErrors: Record<string, string>; // 字段->错误映射
}
```

### SingleResult 结构

```typescript
interface SingleResult {
    value: any; // 转换后的值
    error: string | null; // 错误信息
}
```

### 结果示例

**验证成功**：

```typescript
{
    code: 0,
    failed: false,
    firstError: null,
    errors: [],
    errorFields: [],
    fieldErrors: {}
}
```

**验证失败**：

```typescript
{
    code: 1,
    failed: true,
    firstError: '邮箱为必填项',
    errors: ['邮箱为必填项', '密码长度不能少于6个字符'],
    errorFields: ['email', 'password'],
    fieldErrors: {
        email: '邮箱为必填项',
        password: '密码长度不能少于6个字符'
    }
}
```

---

## 使用示例

### 示例 1：基本验证

```typescript
const data = {
    username: "john",
    age: 25,
    email: "john@example.com"
};

const rules = {
    username: { name: "用户名", type: "string", min: 2, max: 20 },
    age: { name: "年龄", type: "number", min: 0, max: 150 },
    email: { name: "邮箱", type: "string", regexp: "@email" }
};

const result = Validator.validate(data, rules, ["username", "email"]);
// result.code === 0
```

### 示例 2：类型转换

```typescript
const data = {
    age: "25", // 字符串
    score: "98.5" // 字符串
};

const rules = {
    age: { name: "年龄", type: "number", min: 0 },
    score: { name: "分数", type: "number", min: 0, max: 100 }
};

// 验证通过，'25' 会被转换为 25
const result = Validator.validate(data, rules);
```

### 示例 3：数组验证

```typescript
const data = {
    tags: ["vue", "react", "angular"],
    ids: [1, 2, 3]
};

const rules = {
    tags: { name: "标签", type: "array_string", min: 1, max: 10 },
    ids: { name: "ID列表", type: "array_string", min: 1 }
};

const result = Validator.validate(data, rules, ["tags"]);
```

### 示例 4：正则验证

```typescript
const data = {
    phone: "13812345678",
    email: "test@example.com",
    code: "ABC123"
};

const rules = {
    phone: { name: "手机号", type: "string", regexp: "@phone" },
    email: { name: "邮箱", type: "string", regexp: "@email" },
    code: { name: "验证码", type: "string", regexp: "^[A-Z0-9]{6}$" }
};

const result = Validator.validate(data, rules);
```

### 示例 5：单值验证

```typescript
// 验证并转换单个值
const ageResult = Validator.single("25", {
    name: "年龄",
    type: "number",
    min: 0,
    max: 150
});

if (!ageResult.error) {
    console.log(ageResult.value); // 25 (number)
}

// 空值使用默认值
const emptyResult = Validator.single("", {
    name: "数量",
    type: "number",
    default: 10
});
console.log(emptyResult.value); // 10
```

---

## FAQ

### Q: 如何自定义错误信息？

A: 目前错误信息由验证器自动生成，格式为 `{字段标签}{错误描述}`。可以在 API handler 中捕获验证结果后自定义处理。

### Q: 如何跳过某些字段的验证？

A: 不在 `fields` 中定义的字段不会被验证。如果字段不在 `required` 数组中且值为空，也会跳过验证。

### Q: 验证失败后请求参数还能用吗？

A: 验证失败时 Hook 会直接返回错误响应，不会执行 API handler。如果需要在 handler 中手动验证，可以禁用 validator hook。

### Q: 如何验证嵌套对象？

A: 目前只支持扁平对象验证。嵌套对象需要在 handler 中手动验证。

### Q: 正则别名可以扩展吗？

A: 正则别名定义在 `befly/lib/regex` 中，可以直接使用自定义正则字符串，不需要扩展别名。

### Q: 类型转换失败会怎样？

A: 类型转换失败会在 `errors` 中记录错误，如 "年龄必须是数字"。

### Q: 数组元素如何验证？

A: 数组类型会验证：

1. 值是否为数组
2. 元素数量是否在 min/max 范围内
3. 如果有 regexp，每个元素都会进行正则验证

### Q: 如何在验证前清理数据中的 null/undefined 值？

A: 使用 `fieldClear` 工具函数：

```typescript
import { fieldClear } from "befly/utils/fieldClear";

// 在 API handler 中使用
handler: async (befly, ctx) => {
    const { nickname, phone, address } = ctx.body;

    // 清理 null 和 undefined 值
    const cleanData = fieldClear({
        nickname: nickname,
        phone: phone,
        address: address
    }, { excludeValues: [null, undefined] });

    // cleanData 只包含有效值
    await befly.db.updData({
        table: "user",
        data: cleanData,
        where: { id: ctx.user?.id }
    });

    return Yes("更新成功");
};
```

> **注意**：数据库操作（insData、updData 等）会自动过滤 null/undefined 值，通常不需要手动调用 fieldClear。
> 详见 [database.md](../plugins/database.md#nullundefined-值自动过滤)。
