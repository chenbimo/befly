# parseRule 返回值字段重命名：label → name

## 修改日期

2025-10-11

## 修改目标

将 `parseRule()` 函数返回的 `ParsedFieldRule` 接口中的 `label` 字段改名为 `name`，以更准确地表达字段名称的含义。

## 修改原因

1. **语义更准确**：`name` 比 `label` 更能准确表达"字段名称"的含义
2. **命名一致性**：与其他部分的命名风格保持一致
3. **避免歧义**：`label` 容易被理解为"标签"或"显示名"，而实际是字段的名称

## 修改内容

### 1. 类型定义 (`core/types/common.d.ts`)

#### 修改前

```typescript
export interface ParsedFieldRule {
    label: string; // 显示名
    type: 'string' | 'number' | 'text' | 'array';
    min: number | null; // 最小值
    max: number | null; // 最大值
    default: any; // 默认值
    index: 0 | 1; // 是否索引
    regex: string | null; // 正则约束
}
```

#### 修改后

```typescript
export interface ParsedFieldRule {
    name: string; // 字段名称
    type: 'string' | 'number' | 'text' | 'array';
    min: number | null; // 最小值
    max: number | null; // 最大值
    default: any; // 默认值
    index: 0 | 1; // 是否索引
    regex: string | null; // 正则约束
}
```

### 2. 解析函数实现 (`core/utils/tableHelper.ts`)

#### 修改前

```typescript
return {
    label: fieldName,
    type: fieldType as 'string' | 'number' | 'text' | 'array',
    min: fieldMin,
    max: fieldMax,
    default: fieldDefault,
    index: fieldIndex,
    regex: fieldRegx !== 'null' ? fieldRegx : null
};
```

#### 修改后

```typescript
return {
    name: fieldName,
    type: fieldType as 'string' | 'number' | 'text' | 'array',
    min: fieldMin,
    max: fieldMax,
    default: fieldDefault,
    index: fieldIndex,
    regex: fieldRegx !== 'null' ? fieldRegx : null
};
```

#### 文档注释修改

```typescript
// 修改前
 * // {
 * //   label: '用户名',
 * //   type: 'string',
 * //   ...

// 修改后
 * // {
 * //   name: '用户名',
 * //   type: 'string',
 * //   ...
```

### 3. 验证器使用 (`core/utils/validate.ts`)

共修改 3 处使用 `label` 的地方：

#### 修改 1：必填字段检查

```typescript
// 修改前
const fieldLabel = ruleParts.label || fieldName;

// 修改后
const fieldLabel = ruleParts.name || fieldName;
```

#### 修改 2：字段值验证

```typescript
// 修改前
const { label, type, min, max, regex } = parsed;

// 修改后
const { name, type, min, max, regex } = parsed;
```

#### 修改 3：静态验证方法

```typescript
// 修改前
const { label, type, min, max, regex, default: defaultValue } = parsed;

// 修改后
const { name, type, min, max, regex, default: defaultValue } = parsed;
```

#### 修改 4：错误消息中的变量引用（共 18 处）

所有错误消息中的 `${label || '值'}` 都改为 `${name || '值'}`：

```typescript
// 示例（数字验证）
// 修改前
errors.push(`${label || '值'}必须是数字`);
errors.push(`${label || '值'}不能小于${min}`);
errors.push(`${label || '值'}不能大于${max}`);

// 修改后
errors.push(`${name || '值'}必须是数字`);
errors.push(`${name || '值'}不能小于${min}`);
errors.push(`${name || '值'}不能大于${max}`);
```

### 4. 测试文件 (`core/tests/utils.test.ts`)

#### 修改前

```typescript
test('parseRule 应该正确解析字段规则', () => {
    const rule = '用户名|string|3|50|null|1|^[a-zA-Z0-9_]+$';
    const result = parseRule(rule);

    expect(result.label).toBe('用户名');
    // ...
});
```

#### 修改后

```typescript
test('parseRule 应该正确解析字段规则', () => {
    const rule = '用户名|string|3|50|null|1|^[a-zA-Z0-9_]+$';
    const result = parseRule(rule);

    expect(result.name).toBe('用户名');
    // ...
});
```

## 影响范围

### 修改的文件（共 4 个）

1. ✅ `core/types/common.d.ts` - 类型定义
2. ✅ `core/utils/tableHelper.ts` - 解析函数实现和注释
3. ✅ `core/utils/validate.ts` - 验证器中的使用（3 处解构 + 18 处错误消息）
4. ✅ `core/tests/utils.test.ts` - 测试断言

### 未修改的文件

-   `core/scripts/syncDb.ts` - 使用数组解构获取值，不受影响
-   `core/checks/table.ts` - 使用数组解构获取值，不受影响
-   其他使用 `parseRule` 但采用数组解构方式的文件

## 向后兼容性

### ⚠️ 破坏性变更

这是一个**破坏性变更**，会影响所有直接访问 `ParsedFieldRule.label` 属性的代码。

### 迁移指南

如果你的代码中使用了 `parseRule()` 并访问了 `.label` 属性，需要改为 `.name`：

```typescript
// 修改前
const parsed = parseRule(rule);
const fieldName = parsed.label;

// 修改后
const parsed = parseRule(rule);
const fieldName = parsed.name;
```

如果你使用数组解构方式，则无需修改：

```typescript
// 这种方式不受影响
const [fieldName, fieldType, min, max, ...] = parseRule(rule);
```

## 测试结果

✅ **所有测试通过**

```
 81 pass
 1 skip
 0 fail
 150 expect() calls
Ran 82 tests across 7 files. [1.69s]
```

### 验证的测试

1. ✅ `parseRule` 函数解析测试
2. ✅ 字符串验证测试（使用 `name` 生成错误消息）
3. ✅ 数字验证测试（使用 `name` 生成错误消息）
4. ✅ 数组验证测试（使用 `name` 生成错误消息）
5. ✅ 必填字段验证测试（使用 `name` 生成错误消息）

## 优势总结

1. ✅ **语义更清晰**：`name` 准确表达字段名称的含义
2. ✅ **命名一致**：与代码库其他部分保持一致
3. ✅ **类型安全**：TypeScript 会在编译时捕获所有使用 `.label` 的错误
4. ✅ **测试完整**：所有相关测试都已更新并通过
5. ✅ **文档同步**：代码注释和示例都已更新

## 注意事项

1. **确保更新所有直接使用 `.label` 的地方**
2. **类型检查会帮助发现遗漏**：TypeScript 编译器会报错所有访问不存在的 `.label` 属性
3. **优先使用对象解构**：`const { name, type, min, max } = parseRule(rule)` 比数组解构更清晰
4. **错误消息已同步**：所有验证错误消息中的字段名显示都基于 `name` 字段

---

**重命名完成！** 🎉
