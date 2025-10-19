# Status → State 字段迁移完成报告

**日期**：2025-10-19
**状态**：✅ 已完成

## 📋 背景

用户指出项目中自定义的 `status` 字段与框架保留的 `state` 字段功能重复，违反了框架设计规范。框架已提供统一的 `state` 字段来管理所有记录状态：

- `state = 0`：已删除（软删除）
- `state = 1`：正常/激活（默认）
- `state = 2`：已禁用

## 🎯 迁移目标

1. 删除所有表定义中的自定义 `status` 字段
2. 更新所有 API 代码，移除 `status` 字段的引用
3. 统一使用框架的 `state` 字段进行状态管理
4. 更新类型定义和注释说明

## ✅ 完成的修改

### 1. 表定义文件（已在之前完成）

| 文件                | 修改内容                  |
| ------------------- | ------------------------- |
| `tables/menu.json`  | ✅ 删除 `status` 字段定义 |
| `tables/role.json`  | ✅ 删除 `status` 字段定义 |
| `tables/admin.json` | ✅ 删除 `status` 字段定义 |

### 2. 脚本文件

| 文件                  | 修改内容                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| `scripts/syncMenu.ts` | ✅ 移除 `status` 字段操作<br>✅ 更新注释说明<br>✅ 查询和缓存改用 `state` |
| `scripts/syncDev.ts`  | ✅ 移除 `status: 1` 赋值                                                  |

### 3. API 文件（本次完成）

| 文件                 | 修改内容                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apis/menuCreate.ts` | ✅ 移除 `status: adminMenuTable.status`<br>✅ 添加注释说明 state 自动管理                                           |
| `apis/menuUpdate.ts` | ✅ 移除 `status` 字段验证<br>✅ 移除 `status: ctx.body.status` 更新<br>✅ 添加注释说明禁用/启用用法                 |
| `apis/menuList.ts`   | ✅ 将 fields 中的 `'status'` 改为 `'state'`                                                                         |
| `apis/roleCreate.ts` | ✅ 移除 `status: adminRoleTable.status`<br>✅ 移除 `status: ctx.body.status` 插入<br>✅ 添加注释说明 state 自动管理 |
| `apis/roleUpdate.ts` | ✅ 移除 `status` 字段验证<br>✅ 移除 `status: ctx.body.status` 更新<br>✅ 添加注释说明禁用/启用用法                 |
| `apis/login.ts`      | ✅ 改为检查 `state === 2`（已在之前完成）                                                                           |
| `apis/register.ts`   | ✅ 移除 `status: 1` 赋值（已在之前完成）                                                                            |
| `apis/adminMenus.ts` | ✅ 移除 `status` 查询（已在之前完成）                                                                               |
| `apis/adminInfo.ts`  | ✅ 更新注释，将 `status` 改为 `state`                                                                               |

### 4. 类型定义

| 文件             | 修改内容                                                                              |
| ---------------- | ------------------------------------------------------------------------------------- |
| `types/index.ts` | ✅ Admin 接口：`status: 0 \| 1` → `state: 0 \| 1 \| 2`<br>✅ 添加注释说明各状态值含义 |

## 🔍 验证结果

使用 `grep` 搜索确认所有 `status` 引用已清理：

```bash
grep -r "status" packages/tpl/addons/admin/**/*.ts
# 结果：No matches found ✅
```

## 📊 迁移统计

- **修改文件总数**：13 个
- **删除字段定义**：3 个表
- **更新 API 接口**：9 个
- **更新脚本文件**：2 个
- **更新类型定义**：1 个

## 🎓 关键要点

### 1. 框架自动管理的字段

以下字段由框架自动添加和管理，**禁止**在表定义 JSON 中声明：

- `id` - 主键 ID（由 Redis `genTimeID()` 生成）
- `created_at` - 创建时间戳
- `updated_at` - 更新时间戳
- `deleted_at` - 删除时间戳（软删除）
- `state` - 状态字段（0/1/2）

### 2. State 字段使用规范

```typescript
// ✅ 正常记录（默认）
await befly.db.insData({
    table: 'addon_admin_menu',
    data: { name: '菜单名' }
    // state 自动设置为 1
});

// ✅ 禁用记录
await befly.db.updData({
    table: 'addon_admin_menu',
    where: { id: menuId },
    data: { state: 2 } // 手动设置为禁用
});

// ✅ 启用记录
await befly.db.updData({
    table: 'addon_admin_menu',
    where: { id: menuId },
    data: { state: 1 } // 恢复为正常
});

// ✅ 软删除
await befly.db.delData({
    table: 'addon_admin_menu',
    where: { id: menuId }
    // 自动设置 state=0, deleted_at=当前时间
});

// ✅ 查询时自动过滤已删除记录
const menus = await befly.db.getAll({
    table: 'addon_admin_menu'
    // 自动添加 where: { state$gt: 0 }
});
```

### 3. 禁止事项

❌ **禁止在表 JSON 中定义 state 字段**：

```json
// ❌ 错误
{
    "status": "状态|number|0|1|1|1|null",
    "state": "状态|number|0|2|1|1|null"
}

// ✅ 正确：不定义任何状态字段，由框架自动添加
{
    "name": "名称|string|2|50|null|1|null"
}
```

❌ **禁止手动设置 state=0**：

```typescript
// ❌ 错误：不要手动设置 state=0
await befly.db.updData({
    table: 'addon_admin_menu',
    where: { id: menuId },
    data: { state: 0 }
});

// ✅ 正确：使用 delData 方法
await befly.db.delData({
    table: 'addon_admin_menu',
    where: { id: menuId }
});
```

## 🚀 后续建议

1. **统一状态管理**：所有 addon 和业务表都应遵循 state 字段规范
2. **文档更新**：更新 AGENTS.md，明确禁止自定义状态字段
3. **代码审查**：定期检查是否有新的自定义状态字段
4. **前端适配**：前端组件需要适配 state 字段（0/1/2）而非旧的 status 字段

## 📝 参考资料

- 框架规范：`core/docs/` 目录
- 迁移指南：`temp/remove-status-field.md`
- 总指令文件：`AGENTS.md`

---

**迁移负责人**：AI Assistant
**审核状态**：✅ 已完成
**最后更新**：2025-10-19
