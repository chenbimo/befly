# 移除 status 字段，统一使用 state 字段

## 背景

根据框架设计规范，所有表都有框架保留的 `state` 字段来管理数据状态：

- `state = 0`：已删除（软删除）
- `state = 1`：正常/启用
- `state = 2`：禁用

之前的代码中错误地使用了 `status` 字段，与框架的 `state` 字段功能重复，造成混淆。

## 修改内容

### 1. 删除表定义中的 status 字段

**修改的表**：

- ✅ `packages/tpl/addons/admin/tables/menu.json` - 删除 `status` 字段
- ✅ `packages/tpl/addons/admin/tables/role.json` - 删除 `status` 字段
- ✅ `packages/tpl/addons/admin/tables/admin.json` - 删除 `status` 字段

### 2. 修改脚本代码

**syncMenu.ts**：

- ✅ 删除同步菜单时对 `status` 字段的设置
- ✅ 删除缓存查询中的 `status` 字段过滤（`where: { status: 1 }`）
- ✅ 框架的 `getAll` 方法会自动过滤 `state > 0` 的数据

**syncDev.ts**：

- ✅ 删除创建/更新 dev 角色时对 `status: 1` 的设置
- ✅ `state` 字段由框架自动设置为 1

### 3. 修改 API 代码

**login.ts**：

```typescript
// 修改前
if (admin.status !== 1) {
    return No('账号已被禁用');
}

// 修改后
if (admin.state === 2) {
    return No('账号已被禁用');
}
```

**register.ts**：

```typescript
// 修改前
data: {
    name: ctx.body.name,
    email: ctx.body.email,
    password: hashedPassword,
    role: 'user',
    status: 1  // ❌ 手动设置
}

// 修改后
data: {
    name: ctx.body.name,
    email: ctx.body.email,
    password: hashedPassword,
    role: 'user'  // ✅ state 由框架自动设置为 1
}
```

**adminMenus.ts**：

- ✅ 删除缓存查询中的 `status` 字段：`where: { status: 1 }`
- ✅ 框架自动过滤 `state > 0` 的数据

## 📋 待处理项

~~以下 API 仍在使用已删除的 `status` 字段，需要更新：~~

✅ **已全部完成**（2025-10-19）：

1. ✅ **menuCreate.ts** - 移除了 `status` 字段验证
2. ✅ **menuUpdate.ts** - 移除了 `status` 字段验证和数据更新
3. ✅ **menuList.ts** - 将 `status` 改为 `state`
4. ✅ **roleCreate.ts** - 移除了 `status` 字段验证和数据插入
5. ✅ **roleUpdate.ts** - 移除了 `status` 字段验证和数据更新
6. ✅ **types/index.ts** - Admin 接口定义改为 `state: 0 | 1 | 2`
7. ✅ **syncMenu.ts** - 更新了注释说明
8. ✅ **adminInfo.ts** - 更新了注释说明

## 框架自动管理

### state 字段的自动管理

**插入数据时**：

```typescript
await befly.db.insData({
    table: 'xxx',
    data: {
        name: 'test'
        // state 自动设置为 1（正常）
        // id, created_at, updated_at 也会自动生成
    }
});
```

**查询数据时**：

```typescript
// 所有查询方法（getOne, getList, getAll）默认只返回 state > 0 的数据
await befly.db.getOne({ table: 'xxx', where: { id: 1 } });
// 相当于：SELECT * FROM xxx WHERE id = 1 AND state > 0
```

**更新数据时**：

```typescript
// 可以手动设置 state = 2 来禁用记录
await befly.db.updData({
    table: 'xxx',
    where: { id: 1 },
    data: { state: 2 } // 禁用
});
```

**删除数据时**：

```typescript
// 软删除，设置 state = 0 和 deleted_at
await befly.db.delData({
    table: 'xxx',
    where: { id: 1 }
});
```

## 状态管理规范

### 正确的状态管理方式

1. **正常/启用**：`state = 1`（默认值，框架自动设置）
2. **禁用**：`state = 2`（需要手动设置）
3. **删除**：`state = 0`（使用 `delData` 方法软删除）

### 示例代码

**禁用账号**：

```typescript
await befly.db.updData({
    table: 'addon_admin_admin',
    where: { id: adminId },
    data: { state: 2 }
});
```

**启用账号**：

```typescript
await befly.db.updData({
    table: 'addon_admin_admin',
    where: { id: adminId },
    data: { state: 1 }
});
```

**检查账号状态**：

```typescript
const admin = await befly.db.getOne({
    table: 'addon_admin_admin',
    where: { email: 'user@example.com' }
});

if (admin.state === 2) {
    return No('账号已被禁用');
}
```

## 测试验证

**测试 syncMenu**：

```bash
bun addons/admin/scripts/syncMenu.ts
```

输出：

```
✅ 新增菜单: 0 个
✅ 更新菜单: 6 个
✅ 已缓存 7 个菜单到 Redis (Key: befly:menus:all)
```

**验证缓存**：

- ✅ Redis 缓存正常工作
- ✅ 菜单数据不包含 `status` 字段
- ✅ 框架自动过滤 `state > 0` 的数据

## 优势

1. **统一性**：所有表使用统一的 `state` 字段管理状态
2. **简化**：不需要在表定义中声明 `state` 字段，框架自动管理
3. **规范性**：符合框架设计规范，避免字段冗余
4. **清晰性**：状态含义明确（0=删除，1=正常，2=禁用）
5. **自动化**：框架自动过滤已删除的数据，无需手动添加条件

## 注意事项

1. **不要在表定义 JSON 中声明 state 字段**：这是框架保留字段，会自动添加
2. **查询时默认过滤 state > 0**：如需查询所有数据（包括已删除），需要明确指定 `state` 条件
3. **禁用功能使用 state = 2**：不要创建额外的 `status` 字段
4. **删除使用 delData 方法**：这是软删除，设置 `state = 0` 和 `deleted_at`

## ✅ 迁移完成（2025-10-19）

所有 `status` 字段引用已全部清理完毕：

- ✅ menuCreate.ts - 移除 status 字段验证
- ✅ menuUpdate.ts - 移除 status 字段验证和更新
- ✅ menuList.ts - 将 status 改为 state
- ✅ roleCreate.ts - 移除 status 字段验证和插入
- ✅ roleUpdate.ts - 移除 status 字段验证和更新
- ✅ types/index.ts - Admin 接口改为 `state: 0 | 1 | 2`
- ✅ syncMenu.ts - 更新注释说明
- ✅ adminInfo.ts - 更新注释说明

**验证结果**：

```bash
grep -r "status" packages/tpl/addons/admin/**/*.ts
# 结果：No matches found ✅
```

项目已完全遵循框架的 `state` 字段规范，所有状态管理统一使用框架保留的 `state` 字段（0=删除，1=正常，2=禁用）。
