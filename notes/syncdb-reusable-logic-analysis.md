# syncDb 模块可复用逻辑分析报告

**日期**: 2025-10-12
**分析范围**: core/scripts/syncDb 目录

## 发现的重复模式

### 1. ⭐ SQL 类型计算（7 处重复）

**重复代码**:

```typescript
const sqlType = fieldType === 'string' || fieldType === 'array' ? `${typeMapping[fieldType]}(${fieldMax})` : typeMapping[fieldType];
```

**出现位置**:

-   `ddl.ts` - buildBusinessColumnDefs (line 83)
-   `ddl.ts` - generateDDLClause (line 110)
-   `table.ts` - 字段长度检查 (line 77)
-   `table.ts` - 长度变更检查 (line 124)
-   其他位置的类似判断

**复用价值**: ⭐⭐⭐⭐⭐
**复杂度**: 低
**建议**: 提取为 `getSqlType(fieldType, fieldMax)` 函数

---

### 2. ⭐ 字段规则解析 + 解构（9 处重复）

**重复代码**:

```typescript
const parsed = parseRule(fieldRule);
const { name: fieldName, type: fieldType, max: fieldMax, default: fieldDefault } = parsed;
```

**出现位置**:

-   `ddl.ts` - buildBusinessColumnDefs (line 81-82)
-   `ddl.ts` - generateDDLClause (line 108-109)
-   `table.ts` - 4 处
-   `apply.ts` - 1 处
-   `tableCreate.ts` - 2 处

**复用价值**: ⭐⭐⭐
**复杂度**: 低
**建议**: 可能不需要提取（代码太简单，提取后反而增加理解成本）

---

### 3. ⭐ 字符串/数组类型判断（7 处重复）

**重复代码**:

```typescript
fieldType === 'string' || fieldType === 'array';
```

**复用价值**: ⭐⭐⭐⭐
**复杂度**: 极低
**建议**: 提取为 `isStringOrArrayType(fieldType)` 函数

---

### 4. ⭐ COMMENT 转义（2 处重复）

**重复代码**:

```typescript
String(fieldName).replace(/"/g, '\\"');
```

**出现位置**:

-   `ddl.ts` - buildBusinessColumnDefs (line 90)
-   `ddl.ts` - generateDDLClause (line 117)

**复用价值**: ⭐⭐⭐
**复杂度**: 极低
**建议**: 提取为 `escapeComment(str)` 函数

---

### 5. ⭐ 字段变更类型标签映射（多处重复）

**重复代码**:

```typescript
const changeLabel = c.type === 'length' ? '长度' : c.type === 'datatype' ? '类型' : c.type === 'comment' ? '注释' : '默认值';
```

**出现位置**:

-   `table.ts` - line 64

**复用价值**: ⭐⭐
**复杂度**: 低
**备注**: 实际上 `constants.ts` 中已有 `CHANGE_TYPE_LABELS`，但未被使用

---

### 6. 索引名称生成（可能的重复）

**可能需要标准化**:

-   索引命名规则
-   索引字段提取逻辑

**复用价值**: ⭐⭐⭐
**需要进一步分析**

---

## 优先级推荐

### 🔥 高优先级（建议提取）

#### 1. `getSqlType(fieldType, fieldMax)` - SQL 类型计算

```typescript
/**
 * 获取 SQL 数据类型
 *
 * @param fieldType - 字段类型（number/string/text/array）
 * @param fieldMax - 最大长度（string/array 类型需要）
 * @returns SQL 类型字符串
 *
 * @example
 * getSqlType('string', 100) // => 'VARCHAR(100)'
 * getSqlType('number', null) // => 'BIGINT'
 * getSqlType('text', null) // => 'TEXT'
 */
export function getSqlType(fieldType: string, fieldMax: number | null): string {
    if (fieldType === 'string' || fieldType === 'array') {
        return `${typeMapping[fieldType]}(${fieldMax})`;
    }
    return typeMapping[fieldType];
}
```

**收益**:

-   消除 7 处重复
-   统一类型映射逻辑
-   便于后续扩展新类型

---

#### 2. `isStringOrArrayType(fieldType)` - 类型判断

```typescript
/**
 * 判断是否为字符串或数组类型（需要长度限制的类型）
 *
 * @param fieldType - 字段类型
 * @returns 是否为 string 或 array
 */
export function isStringOrArrayType(fieldType: string): boolean {
    return fieldType === 'string' || fieldType === 'array';
}
```

**收益**:

-   消除 7 处重复判断
-   语义更清晰
-   便于后续添加其他需要长度的类型

---

#### 3. `escapeComment(str)` - 注释转义

```typescript
/**
 * 转义 SQL 注释中的双引号
 *
 * @param str - 注释字符串
 * @returns 转义后的字符串
 */
export function escapeComment(str: string): string {
    return String(str).replace(/"/g, '\\"');
}
```

**收益**:

-   消除 2 处重复
-   统一转义逻辑
-   便于后续添加其他转义规则

---

### 🔸 中优先级（可选）

#### 4. 使用 `CHANGE_TYPE_LABELS` 常量

**当前问题**: `constants.ts` 中定义了但未使用

**修改建议**:

```typescript
// 当前代码（table.ts line 64）
const changeLabel = c.type === 'length' ? '长度' : c.type === 'datatype' ? '类型' : c.type === 'comment' ? '注释' : '默认值';

// 改为
import { CHANGE_TYPE_LABELS } from './constants.js';
const changeLabel = CHANGE_TYPE_LABELS[c.type] || '未知';
```

**收益**:

-   使用已有常量
-   避免硬编码
-   统一标签管理

---

### 🔹 低优先级（观察）

#### 5. 字段解析解构

**不建议提取的原因**:

-   代码太简单（2 行）
-   提取后反而增加理解成本
-   变量命名可能需要根据上下文调整

---

## 实施计划

### 阶段 1：提取高优先级函数（预计 30 分钟）

1. 在 `helpers.ts` 中添加 3 个函数：

    - `getSqlType()`
    - `isStringOrArrayType()`
    - `escapeComment()`

2. 重构以下文件：
    - `ddl.ts` - 5 处
    - `table.ts` - 4 处
    - `apply.ts` - 1 处

### 阶段 2：使用已有常量（预计 5 分钟）

1. 在 `table.ts` 中导入并使用 `CHANGE_TYPE_LABELS`

### 预期收益

| 指标           | 预期值    |
| -------------- | --------- |
| 消除重复代码   | ~15-20 处 |
| 新增公共函数   | 3 个      |
| 提升代码复用率 | ~10%      |
| 提升可维护性   | 显著      |

---

## 其他发现

### 潜在优化点

1. **索引操作逻辑**: 可能可以进一步抽象
2. **PG 注释处理**: `tableCreate.ts` 中的逻辑可能可以提取
3. **错误消息格式化**: 多处 `join('\n')` 可以统一

### 不建议提取的逻辑

1. 数据库方言判断（`IS_MYSQL`, `IS_PG`）- 已经足够简洁
2. `parseRule` 调用 - 太简单，提取无意义
3. 变更检测逻辑 - 业务逻辑，不应过度抽象

---

## 总结

**推荐实施**: 阶段 1（3 个高优先级函数）+ 阶段 2（使用常量）

**预计时间**: 35 分钟

**投入产出比**: ⭐⭐⭐⭐ (很高)

这些提取都是**真正有价值**的重复逻辑，能显著提升代码质量和可维护性。
