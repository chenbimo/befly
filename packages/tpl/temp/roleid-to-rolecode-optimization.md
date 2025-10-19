# RoleId → RoleCode 查询优化报告

**日期**：2025-10-19
**状态**：✅ 已完成

## 📋 背景

用户要求将角色查询从使用 `roleId`（数据库主键）改为使用 `roleCode`（业务唯一标识符），原因如下：

1. **业务稳定性**：`roleCode` 是业务层面的唯一标识，不会因数据迁移等操作而改变
2. **可读性更好**：代码中的 `'dev'`、`'admin'` 等角色编码比数字 ID 更有意义
3. **解耦数据库**：减少对数据库主键的依赖，提高系统灵活性

## 🎯 修改目标

将所有通过 `roleId` 查询角色的地方改为使用 `roleCode`：

```typescript
// ❌ 修改前：使用 roleId
where: {
    id: admin.roleId;
}

// ✅ 修改后：使用 roleCode
where: {
    code: admin.roleCode;
}
```

## ✅ 完成的修改

### 1. adminMenus.ts - 获取用户菜单

**修改内容**：

- 判断条件：`admin.roleId` → `admin.roleCode`
- 查询条件：`where: { id: admin.roleId }` → `where: { code: admin.roleCode }`

**修改前**：

```typescript
if (!admin || !admin.roleId) {
    return Yes('获取菜单成功', []);
}

const role = await befly.db.getOne({
    table: 'addon_admin_role',
    where: { id: admin.roleId }
});
```

**修改后**：

```typescript
if (!admin || !admin.roleCode) {
    return Yes('获取菜单成功', []);
}

const role = await befly.db.getOne({
    table: 'addon_admin_role',
    where: { code: admin.roleCode }
});
```

### 2. roleSave.ts - 保存用户角色

**修改内容**：

- API 参数：`roleId: Fields._id` → `roleCode: '角色编码|string|2|50|null|1|^[a-zA-Z0-9_]+$'`
- 查询条件：`where: { id: ctx.body.roleId }` → `where: { code: ctx.body.roleCode }`
- 数据更新：`roleId: ctx.body.roleId` → `roleId: role.id`（从查询结果获取）

**修改前**：

```typescript
fields: {
    adminId: Fields._id,
    roleId: Fields._id
},
handler: async (befly, ctx) => {
    const role = await befly.db.getOne({
        table: 'addon_admin_role',
        where: { id: ctx.body.roleId }
    });

    await befly.db.updData({
        table: 'addon_admin_admin',
        where: { id: ctx.body.adminId },
        data: {
            roleId: ctx.body.roleId,
            roleCode: role.code,
            roleType: roleType
        }
    });
}
```

**修改后**：

```typescript
fields: {
    adminId: Fields._id,
    roleCode: '角色编码|string|2|50|null|1|^[a-zA-Z0-9_]+$'
},
handler: async (befly, ctx) => {
    const role = await befly.db.getOne({
        table: 'addon_admin_role',
        where: { code: ctx.body.roleCode }
    });

    await befly.db.updData({
        table: 'addon_admin_admin',
        where: { id: ctx.body.adminId },
        data: {
            roleId: role.id,
            roleCode: role.code,
            roleType: roleType
        }
    });
}
```

### 3. roleGet.ts - 获取用户角色

**修改内容**：

- 判断条件：`admin.roleId` → `admin.roleCode`
- 查询条件：`where: { id: admin.roleId }` → `where: { code: admin.roleCode }`

**修改前**：

```typescript
let roleInfo = null;
if (admin.roleId) {
    roleInfo = await befly.db.getOne({
        table: 'addon_admin_role',
        where: { id: admin.roleId }
    });
}
```

**修改后**：

```typescript
let roleInfo = null;
if (admin.roleCode) {
    roleInfo = await befly.db.getOne({
        table: 'addon_admin_role',
        where: { code: admin.roleCode }
    });
}
```

### 4. adminInfo.ts - 获取用户信息

**修改内容**：

- 判断条件：`admin.roleId` → `admin.roleCode`
- 查询条件：`where: { id: admin.roleId }` → `where: { code: admin.roleCode }`

**修改前**：

```typescript
let roleInfo = null;
if (admin.roleId) {
    roleInfo = await befly.db.getOne({
        table: 'addon_admin_role',
        where: { id: admin.roleId }
    });
}
```

**修改后**：

```typescript
let roleInfo = null;
if (admin.roleCode) {
    roleInfo = await befly.db.getOne({
        table: 'addon_admin_role',
        where: { code: admin.roleCode }
    });
}
```

## 🔍 验证结果

使用 `grep` 搜索确认所有 `roleId` 查询已替换：

```bash
grep -rE "where:\s*\{\s*id:\s*.*\.roleId" packages/tpl/addons/admin/**/*.ts
# 结果：No matches found ✅
```

## 📊 修改统计

- **修改文件总数**：4 个
- **修改 API 接口**：4 个
    - adminMenus.ts
    - roleSave.ts
    - roleGet.ts
    - adminInfo.ts

## 🎓 优化要点

### 1. 为什么使用 roleCode 更好？

**稳定性**：

```typescript
// ❌ roleId 可能因数据迁移、导入导出等操作而改变
// 如果数据库重建，ID 会重新生成

// ✅ roleCode 是业务标识，始终保持不变
// 'dev', 'admin', 'user' 等编码在任何环境都一致
```

**可读性**：

```typescript
// ❌ 使用 ID，不知道具体是什么角色
if (admin.roleId === 1) { ... }

// ✅ 使用编码，一目了然
if (admin.roleCode === 'admin') { ... }
```

**解耦**：

```typescript
// ❌ 紧耦合数据库主键
// 多环境（开发/测试/生产）ID 可能不一致

// ✅ 使用业务标识
// 所有环境都使用相同的 roleCode
```

### 2. admin 表同时保留 roleId 和 roleCode 的原因

**roleId（数字）**：

- 数据库外键关联
- 查询性能优化（数字索引更快）
- 保持数据完整性

**roleCode（字符串）**：

- 业务逻辑判断
- 跨系统数据同步
- 代码可读性和维护性

### 3. 最佳实践

```typescript
// ✅ 推荐：查询时使用 roleCode
const role = await befly.db.getOne({
    table: 'addon_admin_role',
    where: { code: admin.roleCode }
});

// ✅ 推荐：更新时同时更新 roleId 和 roleCode
await befly.db.updData({
    table: 'addon_admin_admin',
    where: { id: adminId },
    data: {
        roleId: role.id, // 保持外键关联
        roleCode: role.code, // 保持业务标识
        roleType: roleType
    }
});

// ✅ 推荐：业务逻辑判断使用 roleCode
if (admin.roleCode === 'dev' || admin.roleCode === 'admin') {
    // 管理员权限
}
```

## 🚀 后续建议

1. **统一查询规范**：
    - 所有角色相关查询都使用 `roleCode`
    - 数据库关联可以保留 `roleId`

2. **数据完整性**：
    - 确保 admin 表的 `roleCode` 字段始终与对应角色同步
    - 在 `roleSave.ts` 中已实现同步更新逻辑

3. **前端适配**：
    - 前端传参改为使用 `roleCode` 而非 `roleId`
    - 下拉选择等组件显示 `code + name` 组合

4. **文档更新**：
    - 更新 API 文档，说明使用 `roleCode` 参数
    - 在 AGENTS.md 中添加角色查询规范

## 📝 影响范围

### API 接口变更

**roleSave.ts**：

- 参数变更：`roleId` → `roleCode`
- 调用方需要传递 `roleCode` 而非 `roleId`

### 内部查询优化

- adminMenus.ts：内部查询优化，不影响接口
- roleGet.ts：内部查询优化，不影响接口
- adminInfo.ts：内部查询优化，不影响接口

## ✅ 测试建议

1. **登录测试**：验证用户登录后菜单权限正常
2. **角色分配**：测试 `roleSave` 接口使用 `roleCode` 参数
3. **用户信息**：验证 `adminInfo` 接口返回正确的角色信息
4. **菜单缓存**：确认 Redis 缓存的菜单数据正常

---

**优化负责人**：AI Assistant
**审核状态**：✅ 已完成
**最后更新**：2025-10-19
