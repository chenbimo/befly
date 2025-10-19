# syncMenu 脚本使用说明

## 功能描述

`syncMenu` 脚本用于将 `menu.json` 配置文件中的菜单数据同步到数据库，采用**增量更新**模式。

## 核心特性

### 1. 增量更新机制

- **判断依据**：根据菜单的 `path` 字段判断菜单是否存在
- **存在则更新**：更新菜单的其他字段（name、icon、sort、type、status、pid）
- **不存在则新增**：插入新的菜单记录
- **不会删除**：配置文件中没有的菜单不会被删除

### 2. 支持层级结构

- 自动维护父子关系（通过 `pid` 字段）
- 递归处理子菜单
- 支持无限层级嵌套

### 3. 预演模式

支持 `--plan` 参数，只显示执行计划，不实际修改数据库。

## 使用方式

### 方式一：交互式执行

```bash
bunx befly
# 选择对应的数字（如：5. syncMenu）
```

### 方式二：直接执行

```bash
# 实际执行
bun packages/tpl/addons/admin/scripts/syncMenu.ts

# 预演模式
bun packages/tpl/addons/admin/scripts/syncMenu.ts --plan
```

## 配置文件格式

配置文件路径：`packages/tpl/addons/admin/config/menu.json`

```json
[
    {
        "name": "首页", // 菜单名称
        "path": "/", // 菜单路径（唯一标识）
        "icon": "DashboardIcon", // 图标
        "sort": 1, // 排序
        "type": 1, // 类型：0=目录，1=菜单
        "status": 1 // 状态：0=禁用，1=启用
    },
    {
        "name": "系统管理",
        "path": "/system",
        "icon": "SettingIcon",
        "sort": 4,
        "type": 0,
        "status": 1,
        "children": [
            // 子菜单
            {
                "name": "菜单管理",
                "path": "/system/menu",
                "icon": "ViewListIcon",
                "sort": 1,
                "type": 1,
                "status": 1
            }
        ]
    }
]
```

## 字段说明

| 字段     | 类型   | 必填 | 说明                           |
| -------- | ------ | ---- | ------------------------------ |
| name     | string | 是   | 菜单名称                       |
| path     | string | 是   | 菜单路径，作为唯一标识         |
| icon     | string | 否   | 图标名称，默认为空             |
| sort     | number | 否   | 排序号，默认为 0               |
| type     | number | 否   | 类型：0=目录，1=菜单，默认为 1 |
| status   | number | 否   | 状态：0=禁用，1=启用，默认为 1 |
| children | array  | 否   | 子菜单数组                     |

## 执行流程

1. 检查 `addon_admin_menu` 表是否存在
2. 读取 `menu.json` 配置文件
3. 遍历菜单配置：
    - 根据 `path` 查询数据库中是否存在
    - 存在 → 更新其他字段
    - 不存在 → 插入新记录
4. 递归处理子菜单
5. 显示菜单树形结构预览
6. 输出统计信息（新增数量、更新数量）

## 使用场景

### 场景 1：初始化菜单

第一次运行时，所有菜单都是新增：

```bash
bun packages/tpl/addons/admin/scripts/syncMenu.ts

# 输出：
# ✅ 新增菜单: 6 个
# ✅ 更新菜单: 0 个
```

### 场景 2：修改菜单名称

修改 `menu.json` 中某个菜单的 `name` 字段后：

```json
{
    "name": "首页2024",  // 修改了名称
    "path": "/",        // path 不变
    ...
}
```

```bash
bun packages/tpl/addons/admin/scripts/syncMenu.ts

# 输出：
# ✅ 新增菜单: 0 个
# ✅ 更新菜单: 6 个（包含这个修改的菜单）
```

### 场景 3：添加新菜单

在 `menu.json` 中添加新菜单：

```json
[
    ...,
    {
        "name": "用户管理",
        "path": "/user",  // 新的 path
        ...
    }
]
```

```bash
bun packages/tpl/addons/admin/scripts/syncMenu.ts

# 输出：
# ✅ 新增菜单: 1 个
# ✅ 更新菜单: 6 个
```

### 场景 4：预演模式

在实际执行前，先查看执行计划：

```bash
bun packages/tpl/addons/admin/scripts/syncMenu.ts --plan

# 输出：
# [计划] 同步菜单配置到数据库（plan 模式不执行）
# [计划] 1. 读取 menu.json 配置文件
# [计划] 2. 根据 path 检查菜单是否存在
# [计划] 3. 存在则更新，不存在则新增
# [计划] 4. 递归处理子菜单
# [计划] 5. 显示菜单结构预览
```

## 注意事项

### 1. path 是唯一标识

- `path` 字段是菜单的唯一标识
- 修改 `path` 会导致创建新菜单，而不是更新现有菜单
- 建议：确定 `path` 后不要轻易修改

### 2. 不会删除菜单

- 从配置文件中移除某个菜单，不会删除数据库中的对应记录
- 如需删除，请手动在数据库中软删除（设置 `deleted_at` 字段）

### 3. 父子关系自动维护

- 子菜单的 `pid` 会自动设置为父菜单的 `id`
- 修改菜单层级关系时，`pid` 会自动更新

### 4. 必须先运行 syncDb

- 首次使用前，必须先运行 `syncDb` 脚本创建 `addon_admin_menu` 表
- 否则会提示：`跳过菜单同步：未检测到 addon_admin_menu 表`

## 常见问题

### Q: 如何删除某个菜单？

A: 有两种方式：

1. **软删除**（推荐）：直接在数据库中将 `deleted_at` 字段设置为当前时间戳
2. **硬删除**：直接在数据库中删除记录（不推荐）

### Q: 修改了 path 会怎样？

A: 会创建新菜单，旧菜单仍然存在。如需更换路径，建议：

1. 先软删除旧菜单（设置 `deleted_at`）
2. 在配置文件中使用新 path
3. 运行 syncMenu 创建新菜单

### Q: 如何调整菜单顺序？

A: 修改配置文件中的 `sort` 字段，然后运行 syncMenu 即可。

### Q: 子菜单的层级关系如何确定？

A: 通过配置文件中的 `children` 数组嵌套关系自动确定，无需手动设置 `pid`。

## 开发建议

1. **版本控制**：将 `menu.json` 纳入版本控制
2. **备份**：修改前备份配置文件
3. **预演先行**：重要修改前先用 `--plan` 模式预览
4. **增量更新**：充分利用增量更新特性，避免重复操作

---

**最后更新**: 2025-10-19
