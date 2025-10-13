# 字段规则分隔符修改总结

## 修改日期

2025-10-11

## 修改内容

将字段规则定义中的分隔符从 `⚡` 改为 `|`

## 修改原因

1. `|` 更加常见和直观
2. 更易于输入和阅读
3. 虽然正则表达式中可能包含 `|`，但通过特殊的解析逻辑可以解决冲突

## 格式变化

### 旧格式

```
"字段名⚡类型⚡最小值⚡最大值⚡默认值⚡索引⚡正则"
```

### 新格式

```
"字段名|类型|最小值|最大值|默认值|索引|正则"
```

## 解析逻辑改进

为了支持正则表达式中的 `|`，采用了手动分割策略：

-   只分割前 6 个 `|`
-   第 7 部分（正则表达式）中的所有 `|` 都会被保留

### 实现示例

```typescript
const parts: string[] = [];
let currentPart = '';
let pipeCount = 0;

for (let i = 0; i < rule.length; i++) {
    if (rule[i] === '|' && pipeCount < 6) {
        parts.push(currentPart);
        currentPart = '';
        pipeCount++;
    } else {
        currentPart += rule[i];
    }
}
parts.push(currentPart);
```

## 修改的文件清单

### 核心代码文件（6 个）

1. `core/utils/tableHelper.ts` - parseRule 函数，字段规则解析
2. `core/checks/table.ts` - 表定义检查器
3. `core/types/common.d.ts` - 类型定义注释

### 表定义文件（2 个）

4. `core/tables/common.json` - 通用字段定义
5. `core/tables/tool.json` - 工具字段定义

### API 定义文件（4 个）

6. `tpl/apis/user/login.ts` - 用户登录接口
7. `tpl/apis/user/list.ts` - 用户列表接口
8. `tpl/apis/article/list.ts` - 文章列表接口
9. `tpl/apis/article/create.ts` - 创建文章接口

### 测试文件（2 个）

10. `core/tests/utils.test.ts` - 工具函数测试
11. `core/tests/validate.test.ts` - 验证器测试

### 文档文件（1 个）

12. `core/docs/syncDb.md` - 数据库同步文档

## 测试结果

✅ **81 个测试全部通过** (1 个跳过)

```
 81 pass
 1 skip
 0 fail
 150 expect() calls
Ran 82 tests across 7 files. [2.12s]
```

## 示例对比

### 简单规则（无正则）

```json
// 旧格式
"page": "页码⚡number⚡1⚡9999⚡1⚡0⚡null"

// 新格式
"page": "页码|number|1|9999|1|0|null"
```

### 复杂规则（包含正则）

```json
// 旧格式
"status": "状态⚡string⚡1⚡20⚡active⚡1⚡^(active|inactive|pending|suspended)$"

// 新格式
"status": "状态|string|1|20|active|1|^(active|inactive|pending|suspended)$"
```

注意：正则表达式中的 `|` 会被正确保留，不会被当作分隔符。

## 兼容性说明

⚠️ **不向后兼容**

此次修改**不保留向后兼容性**，所有使用旧格式 `⚡` 的定义都必须更新为新格式 `|`。

## 迁移检查清单

如果你有自定义的表定义或 API 定义，需要检查以下位置：

-   [ ] `tables/*.json` - 所有表定义文件
-   [ ] `apis/**/*.ts` - 所有 API 接口文件中的 `fields` 字段
-   [ ] 任何直接使用字段规则字符串的代码

## 优势总结

1. ✅ **更好的可读性** - `|` 比 `⚡` 更直观
2. ✅ **更易输入** - 不需要特殊输入法或复制粘贴
3. ✅ **正则兼容** - 通过解析逻辑支持正则中的 `|`
4. ✅ **测试覆盖** - 所有测试通过，包括正则测试用例
5. ✅ **文档完整** - 相关文档已同步更新

## 注意事项

1. 正则表达式中可以自由使用 `|`，不会与字段分隔符冲突
2. 确保字段规则始终包含 7 个部分（用 6 个 `|` 分隔）
3. 如果正则不需要，第 7 部分可以使用 `null`
