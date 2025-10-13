# 代码重构：复用 parseRule 函数

## 重构日期

2025-10-11

## 重构目标

消除 `checks/table.ts` 中的重复解析逻辑，复用 `utils/tableHelper.ts` 中的 `parseRule` 函数。

## 问题分析

### 重复代码

在 `checks/table.ts` 中存在与 `parseRule` 函数完全相同的字段规则解析逻辑：

```typescript
// 重复的分割逻辑
const allParts: string[] = [];
let currentPart = '';
let pipeCount = 0;

for (let i = 0; i < rule.length; i++) {
    if (rule[i] === '|' && pipeCount < 6) {
        allParts.push(currentPart);
        currentPart = '';
        pipeCount++;
    } else {
        currentPart += rule[i];
    }
}
allParts.push(currentPart);
```

这段代码与 `utils/tableHelper.ts` 中的 `parseRule` 函数逻辑完全一致。

## 重构方案

### 修改前

```typescript
// 手动分割并解构
const allParts: string[] = [];
let currentPart = '';
let pipeCount = 0;

for (let i = 0; i < rule.length; i++) {
    if (rule[i] === '|' && pipeCount < 6) {
        allParts.push(currentPart);
        currentPart = '';
        pipeCount++;
    } else {
        currentPart += rule[i];
    }
}
allParts.push(currentPart);

const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = allParts;

// 后续验证使用字符串值
if (fieldMin === 'null' || !Number.isNaN(Number(fieldMin))) { ... }
if (fieldIndex !== '0' && fieldIndex !== '1') { ... }
```

### 修改后

```typescript
// 使用 parseRule 函数
let parsed;
try {
    parsed = parseRule(rule);
} catch (error: any) {
    Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 字段规则解析失败：${error.message}`);
    fileValid = false;
    continue;
}

const { label: fieldName, type: fieldType, min: fieldMin, max: fieldMax,
        default: fieldDefault, index: fieldIndex, regex: fieldRegx } = parsed;

// 后续验证使用正确的类型
if (!(fieldMin === null || typeof fieldMin === 'number')) { ... }
if (fieldIndex !== 0 && fieldIndex !== 1) { ... }
```

## 重构优势

### 1. **消除代码重复** ✅

-   删除了 15 行重复的分割逻辑
-   统一使用 `parseRule` 函数进行解析

### 2. **类型安全** ✅

-   使用解析后的类型值（`number | null`）而不是字符串
-   减少了类型转换和验证的复杂度

### 3. **更易维护** ✅

-   解析逻辑集中在一处
-   修改解析规则只需改一个地方

### 4. **错误处理更好** ✅

-   利用 `parseRule` 的错误处理机制
-   统一的错误提示格式

## 代码对比

### 验证逻辑改进

#### 最小值/最大值验证

```typescript
// 修改前：字符串比较
if (!(fieldMin === 'null' || !Number.isNaN(Number(fieldMin)))) { ... }
if (fieldMin !== 'null' && fieldMax !== 'null') {
    if (Number(fieldMin) > Number(fieldMax)) { ... }
}

// 修改后：直接类型比较
if (!(fieldMin === null || typeof fieldMin === 'number')) { ... }
if (fieldMin !== null && fieldMax !== null) {
    if (fieldMin > fieldMax) { ... }
}
```

#### 索引验证

```typescript
// 修改前：字符串比较
if (fieldIndex !== '0' && fieldIndex !== '1') { ... }

// 修改后：数字比较
if (fieldIndex !== 0 && fieldIndex !== 1) { ... }
```

#### 类型联动验证

```typescript
// 修改前：字符串比较
if (fieldType === 'text') {
    if (fieldMin !== 'null') { ... }
    if (fieldMax !== 'null') { ... }
}
else if (fieldType === 'string' || fieldType === 'array') {
    if (Number.isNaN(Number(fieldMax))) { ... }
    const maxVal = parseInt(fieldMax, 10);
    if (maxVal > MAX_VARCHAR_LENGTH) { ... }
}

// 修改后：类型比较
if (fieldType === 'text') {
    if (fieldMin !== null) { ... }
    if (fieldMax !== null) { ... }
}
else if (fieldType === 'string' || fieldType === 'array') {
    if (fieldMax === null || typeof fieldMax !== 'number') { ... }
    else if (fieldMax > MAX_VARCHAR_LENGTH) { ... }
}
```

## 测试结果

✅ **所有测试通过**

```
 81 pass
 1 skip
 0 fail
 150 expect() calls
Ran 82 tests across 7 files. [2.08s]
```

## 代码统计

### 修改文件

-   `core/checks/table.ts` - 表定义检查器

### 代码变化

-   **删除**：~25 行重复代码
-   **新增**：~10 行调用 parseRule 的代码
-   **净减少**：~15 行代码

### 复杂度降低

-   **减少**：1 个手动解析循环
-   **减少**：多处字符串转换逻辑
-   **增强**：类型安全性

## 重构原则

本次重构遵循以下原则：

1. **DRY (Don't Repeat Yourself)** - 不重复代码

    - 消除了完全相同的解析逻辑

2. **单一职责原则**

    - 解析逻辑由 `parseRule` 统一负责
    - 验证逻辑专注于业务规则检查

3. **类型安全**

    - 使用 TypeScript 类型而不是字符串
    - 减少运行时类型转换

4. **可维护性**
    - 逻辑集中，易于修改
    - 减少了潜在的 bug 点

## 后续优化建议

### 1. 考虑提取验证逻辑

可以将字段类型验证逻辑提取为独立函数：

```typescript
function validateFieldType(fieldType: string, fieldMin: number | null, fieldMax: number | null, fieldDefault: any): ValidationResult {
    // 验证逻辑
}
```

### 2. 考虑使用 Zod 等验证库

可以使用更强大的验证库来替代手动验证：

```typescript
const fieldRuleSchema = z.object({
    label: z.string().regex(FIELD_NAME_REGEX),
    type: z.enum(['string', 'number', 'text', 'array']),
    min: z.number().nullable(),
    max: z.number().nullable()
    // ...
});
```

### 3. 添加更多单元测试

为 `parseRule` 函数添加更多边界情况的测试。

## 总结

通过本次重构：

-   ✅ 消除了代码重复
-   ✅ 提高了类型安全性
-   ✅ 降低了维护成本
-   ✅ 保持了所有测试通过
-   ✅ 代码量减少约 15 行

这是一次成功的代码重构！🎉
