# 菜单配置（menus / adminViews 扫描）

本页描述菜单的**来源、结构、禁用规则**。菜单同步写入的表为 `addon_admin_menu`。

## 菜单来源

菜单来自两部分，最终会合并后同步到数据库：

1. **Addon 的 adminViews 目录扫描**
2. **项目根目录的 `menus.json`**（可选）

### 1) Addon adminViews 扫描

对每个 addon，会尝试寻找 admin views 目录（满足其一即可）：

-   `<addonRoot>/adminViews`
-   `<addonRoot>/views/admin`

扫描规则（目录 → 菜单）：

-   只扫描目录（跳过文件）
-   跳过名为 `components` 的目录
-   目录下必须同时存在：
    -   `meta.json`
    -   `index.vue`
-   `meta.json` 必须包含：
    -   `title: string`
    -   可选：`order: number`（整数，>=0）

路径生成规则：

-   addon 菜单统一带前缀：`/<addonSource>/<addonName>`
    -   addon 来自 node_modules：`addonSource="addon"` → `/addon/<addonName>`
    -   addon 来自项目本地 addons：`addonSource="app"` → `/app/<addonName>`
-   子目录名会去掉尾部的 `_数字`（例如 `user_1` → `user`）
-   目录名为 `index` 时，表示“继承父级路径”

树结构：

-   子目录形成 `children`
-   同级节点按 `order` 升序排序（缺省为很大值）

### 2) 项目 menus.json

如果存在 `process.cwd()/menus.json`，并且其内容为数组，会被追加到菜单列表中。

（你可以手写固定菜单，或补充 addon 扫描不到的菜单。）

## MenuConfig 结构

每个菜单节点遵循 `MenuConfig`（`befly/types/sync`）：

-   `path?: string`
-   `name?: string`
-   `sort?: number`
-   `parentPath?: string`（可选。你不写时会由树结构推导）
-   `children?: MenuConfig[]`

最小示例：

```json
[
    {
        "name": "仪表盘",
        "path": "/app/admin/dashboard",
        "sort": 1
    }
]
```

## parentPath 推导规则

当菜单节点未显式提供 `parentPath` 时：

1. 优先由 `children` 的树结构推导父级（根级为 ""）
2. 极端情况下回退到 `getParentPath(path)`（例如 `/a/b` → `/a`）

## 禁用菜单（disableMenus，强约束）

配置项：`disableMenus: string[]`（见 `config.md`）。

行为：

-   同步时会用 Bun.Glob 进行匹配
-   命中规则的菜单：
    -   **不会写入数据库**
    -   并且会在数据库中被**强制删除（不分 state，包括历史禁用数据）**

匹配兼容：`/a/b` 与 `a/b` 都会参与匹配（双候选兜底）。

示例：

```json
{
    "disableMenus": ["**/login", "/addon/admin/**"]
}
```

## 同步前置条件

只有当数据库存在 `addon_admin_menu` 表时，才会执行菜单同步。
