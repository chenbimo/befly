# Sync 同步命令

> 数据库结构、API路由、菜单配置、开发账户同步

## 目录

- [概述](#概述)
- [syncAll 全量同步](#syncall-全量同步)
- [syncDb 数据库同步](#syncdb-数据库同步)
- [syncApi 接口同步](#syncapi-接口同步)
- [syncMenu 菜单同步](#syncmenu-菜单同步)
- [syncDev 开发账户同步](#syncdev-开发账户同步)
- [命令行使用](#命令行使用)
- [表名规则](#表名规则)
- [注意事项](#注意事项)
- [FAQ](#faq)

---

## 概述

Sync 同步系统用于将代码定义同步到数据库，包括：

| 命令       | 功能              | 目标表                                  |
| ---------- | ----------------- | --------------------------------------- |
| `syncDb`   | 同步表结构定义    | 所有业务表                              |
| `syncApi`  | 同步 API 路由信息 | `addon_admin_api`                       |
| `syncMenu` | 同步菜单配置      | `addon_admin_menu`                      |
| `syncDev`  | 创建开发者账户    | `addon_admin_role`, `addon_admin_admin` |
| `syncAll`  | 依次执行以上全部  | -                                       |

**执行顺序**：`checkApp` → `syncDb` → `syncApi` → `syncMenu` → `syncDev`

---

## syncAll 全量同步

一键执行所有同步命令：

```bash
# 执行全量同步
befly sync

# 等同于依次执行：
# 1. checkApp - 检查应用配置
# 2. syncDb   - 同步数据库表结构
# 3. syncApi  - 同步 API 路由
# 4. syncMenu - 同步菜单配置
# 5. syncDev  - 同步开发账户
```

**执行流程**：

```
┌──────────────────────────────────────────────────┐
│                  syncAll                         │
├──────────────────────────────────────────────────┤
│  1. checkApp()      检查应用配置是否完整          │
│         ↓                                        │
│  2. syncDbCommand() 同步数据库表结构              │
│         ↓                                        │
│  3. syncApiCommand() 同步 API 路由到数据库        │
│         ↓                                        │
│  4. syncMenuCommand() 同步菜单配置到数据库        │
│         ↓                                        │
│  5. syncDevCommand() 创建/更新开发者账户          │
└──────────────────────────────────────────────────┘
```

---

## syncDb 数据库同步

将 `tables/*.json` 表定义同步到数据库结构。

### 基本用法

```bash
# 同步所有表
befly sync:db

# 只同步指定表
befly sync:db --table user

# 强制模式（允许破坏性操作）
befly sync:db --force

# 预览模式（仅显示变更，不执行）
befly sync:db --dry-run
```

### 命令选项

| 选项        | 类型    | 默认值 | 说明                 |
| ----------- | ------- | ------ | -------------------- |
| `--table`   | string  | -      | 只同步指定表         |
| `--force`   | boolean | false  | 强制模式，允许删除列 |
| `--dry-run` | boolean | false  | 预览模式，不实际执行 |

### 同步逻辑

```
┌─────────────────────────────────────────────────────┐
│                    syncDb                           │
├─────────────────────────────────────────────────────┤
│  1. 设置数据库类型 (setDbType)                       │
│  2. 检查表定义完整性 (checkTable)                    │
│  3. 连接数据库 (Connect.connectSql)                 │
│  4. 确保版本表存在 (ensureDbVersion)                 │
│         ↓                                           │
│  5. 扫描表定义文件：                                 │
│     - 项目表：tpl/tables/*.json                     │
│     - Addon 表：addons/*/tables/*.json              │
│         ↓                                           │
│  6. 对每个表：                                       │
│     ├── 表存在？→ modifyTable (修改)                │
│     └── 表不存在？→ createTable (新建)              │
│         ↓                                           │
│  7. 清理 Redis 缓存 (tableColumns)                  │
│  8. 关闭数据库连接                                   │
└─────────────────────────────────────────────────────┘
```

### 自动添加字段

每个表自动添加以下系统字段：

| 字段         | 类型    | 说明                            |
| ------------ | ------- | ------------------------------- |
| `id`         | BIGINT  | 主键，自增                      |
| `created_at` | BIGINT  | 创建时间戳                      |
| `updated_at` | BIGINT  | 更新时间戳                      |
| `state`      | TINYINT | 状态（1=正常，0=禁用，-1=删除） |

### 示例

**表定义文件** `tables/user.json`：

```json
{
    "email": "邮箱|string|5|100||true|^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$",
    "password": "密码|string|6|100||true",
    "nickname": "昵称|string|2|50|用户",
    "avatar": "头像|string|0|500",
    "phone": "手机号|string|0|20"
}
```

**同步结果**：创建/更新 `user` 表，包含定义的字段 + 系统字段。

---

## syncApi 接口同步

将 API 路由定义同步到 `addon_admin_api` 表。

### 基本用法

```bash
# 同步 API 路由
befly sync:api

# 预览模式
befly sync:api --plan
```

### 命令选项

| 选项     | 类型    | 默认值 | 说明                   |
| -------- | ------- | ------ | ---------------------- |
| `--plan` | boolean | false  | 预览模式，显示变更计划 |

### 同步逻辑

```
┌─────────────────────────────────────────────────────┐
│                    syncApi                          │
├─────────────────────────────────────────────────────┤
│  1. 扫描 API 文件：                                  │
│     - 项目 API：tpl/apis/**/*.ts                    │
│     - Addon API：addons/*/apis/**/*.ts              │
│         ↓                                           │
│  2. 提取 API 信息：                                  │
│     - name: 接口名称                                │
│     - path: 路由路径                                │
│     - method: 请求方法                              │
│     - description: 接口描述                         │
│     - addonName: 所属 Addon                        │
│         ↓                                           │
│  3. 同步到 addon_admin_api 表：                      │
│     - 新增不存在的 API                              │
│     - 更新已存在的 API                              │
│     - 删除代码中已移除的 API                         │
└─────────────────────────────────────────────────────┘
```

### API 信息提取

从 API 文件中提取以下信息：

```typescript
interface ApiInfo {
    name: string; // 接口名称（name 属性）
    path: string; // 路由路径（由文件路径生成）
    method: string; // 请求方法（method 属性，默认 POST）
    description: string; // 接口描述（desc 属性）
    addonName: string; // 所属 Addon 名称
    addonTitle: string; // Addon 标题
}
```

### 统计信息

```typescript
interface SyncApiStats {
    totalApis: number; // API 总数
    created: number; // 新增数量
    updated: number; // 更新数量
    deleted: number; // 删除数量
}
```

---

## syncMenu 菜单同步

将 `views/**/index.vue` 中的 `definePage({ meta })` 菜单配置同步到 `addon_admin_menu` 表。

### 基本用法

```bash
# 同步菜单
befly sync:menu

# 预览模式
befly sync:menu --plan
```

### 命令选项

| 选项     | 类型    | 默认值 | 说明                   |
| -------- | ------- | ------ | ---------------------- |
| `--plan` | boolean | false  | 预览模式，显示变更计划 |

### 菜单配置文件

在 `views/{menuName}/index.vue` 中用 `definePage()` 定义菜单：

```vue
<script setup>
definePage({
    meta: {
        title: "用户管理",
        order: 10
    }
});
</script>
```

**配置字段**：

| 字段    | 类型   | 必填 | 说明                 |
| ------- | ------ | ---- | -------------------- |
| `title` | string | 是   | 菜单名称             |
| `order` | number | 否   | 排序权重，越小越靠前 |

### 目录结构

```
views/
├── index/              # 首页
│   ├── index.vue
│   └── index.vue       # definePage({ meta: { title: "首页", order: 1 } })
├── user/               # 用户管理（父菜单）
│   ├── index.vue       # definePage({ meta: { title: "用户管理", order: 10 } })
│   ├── list/           # 用户列表（子菜单）
│   │   └── index.vue   # definePage({ meta: { title: "用户列表", order: 1 } })
│   └── detail/         # 用户详情（子菜单）
│       └── index.vue   # definePage({ meta: { title: "用户详情", order: 2 } })
└── setting/            # 系统设置
    └── index.vue       # definePage({ meta: { title: "系统设置", order: 99 } })
```

### 同步逻辑

```
┌─────────────────────────────────────────────────────┐
│                   syncMenu                          │
├─────────────────────────────────────────────────────┤
│  1. 扫描 views 目录：                                │
│     - 项目：tpl/views/                              │
│     - Addon：addons/*/views/                        │
│         ↓                                           │
│  2. 读取每个目录 index.vue 的 definePage(meta) 配置   │
│         ↓                                           │
│  3. 构建菜单树（父子关系由目录层级决定）              │
│         ↓                                           │
│  4. 过滤隐藏菜单（hidden: true）                     │
│         ↓                                           │
│  5. 同步到 addon_admin_menu 表：                     │
│     - 新增不存在的菜单                              │
│     - 更新已存在的菜单                              │
│     - 删除代码中已移除的菜单                         │
└─────────────────────────────────────────────────────┘
```

### 统计信息

```typescript
interface SyncMenuStats {
    totalMenus: number; // 菜单总数
    parentMenus: number; // 父菜单数量
    childMenus: number; // 子菜单数量
    created: number; // 新增数量
    updated: number; // 更新数量
    deleted: number; // 删除数量
}
```

---

## syncDev 开发账户同步

创建开发环境的管理员账户和角色。

### 基本用法

```bash
# 同步开发账户
befly sync:dev

# 预览模式
befly sync:dev --plan
```

### 命令选项

| 选项     | 类型    | 默认值 | 说明                   |
| -------- | ------- | ------ | ---------------------- |
| `--plan` | boolean | false  | 预览模式，显示变更计划 |

### 同步逻辑

```
┌─────────────────────────────────────────────────────┐
│                   syncDev                           │
├─────────────────────────────────────────────────────┤
│  1. 创建/更新开发角色：                              │
│     - 角色名称：开发者                              │
│     - 角色标识：dev                                 │
│     - 权限：所有菜单 + 所有 API                     │
│         ↓                                           │
│  2. 获取所有菜单 ID 列表                            │
│         ↓                                           │
│  3. 获取所有 API ID 列表                            │
│         ↓                                           │
│  4. 更新角色权限：                                   │
│     - menus: 所有菜单 ID                           │
│     - apis: 所有 API ID                            │
│         ↓                                           │
│  5. 创建/更新开发管理员：                            │
│     - 用户名：dev                                   │
│     - 密码：从配置读取                              │
│     - 角色：开发者角色                              │
└─────────────────────────────────────────────────────┘
```

### 配置说明

开发账户配置在 `befly.config.ts` 或环境配置文件中：

```typescript
// befly.config.ts
export default {
    dev: {
        username: "dev", // 开发账户用户名
        password: "dev123456" // 开发账户密码
    }
};
```

**注意**：此命令仅用于开发环境，生产环境应通过正式流程创建管理员。

---

## 命令行使用

### CLI 命令列表

```bash
# 全量同步
befly sync

# 单独执行
befly sync:db              # 同步数据库结构
befly sync:api             # 同步 API 路由
befly sync:menu            # 同步菜单配置
befly sync:dev             # 同步开发账户

# 带参数
befly sync:db --table user     # 只同步 user 表
befly sync:db --force          # 强制模式
befly sync:db --dry-run        # 预览模式
befly sync:api --plan          # 预览 API 变更
befly sync:menu --plan         # 预览菜单变更
befly sync:dev --plan          # 预览开发账户变更
```

### 代码调用

```typescript
import { syncAllCommand } from "./sync/syncAll";
import { syncDbCommand } from "./sync/syncDb";
import { syncApiCommand } from "./sync/syncApi";
import { syncMenuCommand } from "./sync/syncMenu";
import { syncDevCommand } from "./sync/syncDev";

// 全量同步
await syncAllCommand();

// 单独调用
await syncDbCommand({ table: "user" });
await syncApiCommand({ plan: true });
await syncMenuCommand({ plan: true });
await syncDevCommand({ plan: true });
```

---

## 表名规则

### 项目表

项目表直接使用文件名（转换为下划线格式）：

```
tables/user.json         → user
tables/userProfile.json  → user_profile
tables/order_item.json   → order_item
```

### Addon 表

Addon 表使用 `addon_{addonName}_{tableName}` 格式：

```
addons/admin/tables/role.json     → addon_admin_role
addons/admin/tables/menu.json     → addon_admin_menu
addons/demo/tables/article.json   → addon_demo_article
```

### 命名转换

| 源文件名            | 表名           |
| ------------------- | -------------- |
| `user.json`         | `user`         |
| `userProfile.json`  | `user_profile` |
| `UserProfile.json`  | `user_profile` |
| `user_profile.json` | `user_profile` |

---

## 注意事项

### 1. 执行顺序

**必须按顺序执行**：`syncDb` → `syncApi` → `syncMenu` → `syncDev`

- `syncApi` 依赖 `addon_admin_api` 表（由 `syncDb` 创建）
- `syncMenu` 依赖 `addon_admin_menu` 表（由 `syncDb` 创建）
- `syncDev` 依赖角色表和权限数据（由前面命令创建）

### 2. 破坏性操作

默认模式下，`syncDb` **不会删除列**，只会：

- 新增缺失的列
- 修改现有列的类型/默认值

使用 `--force` 参数允许删除列：

```bash
# 谨慎使用！会删除数据库中存在但定义中不存在的列
befly sync:db --force
```

### 3. 缓存清理

`syncDb` 执行后会自动清理 Redis 中的表结构缓存：

```typescript
// 自动清理以下缓存键
CacheKeys.tableColumns(tableName); // table:columns:{tableName}
```

### 4. 连接管理

Sync 命令会自动管理数据库和 Redis 连接：

- 执行前建立连接
- 执行后关闭连接
- 出错时正确清理资源

### 5. 预览模式

使用 `--dry-run` 或 `--plan` 参数可以预览变更而不实际执行：

```bash
befly sync:db --dry-run   # 预览数据库结构变更
befly sync:api --plan     # 预览 API 变更
befly sync:menu --plan    # 预览菜单变更
```

---

## FAQ

### Q: sync 命令报错 "表不存在" 怎么办？

A: 确保先执行 `befly sync:db` 创建表结构，再执行其他 sync 命令。或直接使用 `befly sync` 执行全量同步。

### Q: 为什么修改了表定义但数据库没变化？

A: 检查以下几点：

1. JSON 文件语法是否正确
2. 字段定义格式是否正确
3. 是否保存了文件
4. 尝试使用 `--dry-run` 查看预期变更

### Q: 如何删除数据库中不需要的列？

A: 使用 `--force` 参数：

```bash
befly sync:db --force
```

**警告**：这会删除表定义中不存在的列及其数据，请先备份。

### Q: Addon 表名太长怎么办？

A: Addon 表名格式为 `addon_{addonName}_{tableName}`，建议：

- 使用简短的 Addon 名称
- 使用简短的表名
- MySQL 表名限制 64 字符

### Q: 同步失败后如何恢复？

A:

1. 检查错误日志确定失败原因
2. 修复问题后重新执行 sync 命令
3. sync 命令是幂等的，可以安全地多次执行

### Q: 如何只同步某个 Addon 的表？

A: 目前不支持按 Addon 筛选，可以使用 `--table` 参数同步单个表：

```bash
befly sync:db --table addon_admin_role
```

### Q: 开发账户密码在哪里配置？

A: 在配置文件中设置：

```typescript
// befly.config.ts
export default {
    dev: {
        username: "dev",
        password: "your_password"
    }
};
```

或使用环境变量：

```bash
DEV_PASSWORD=your_password befly sync:dev
```
