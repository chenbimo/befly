# 菜单配置（menus / adminViews 扫描）

本页描述菜单的**来源、结构、禁用规则**。菜单同步写入的表为 `addon_admin_menu`。

## 菜单来源

菜单来自两部分，最终会合并后同步到数据库：

1. **Addon 的 adminViews 目录扫描**
2. **项目根目录的 `menus.json`**（可选）

### 1) Addon adminViews 扫描

对每个 addon，会尝试寻找 admin views 目录（满足其一即可）：

- `<addonRoot>/adminViews`
- `<addonRoot>/views/admin`

扫描规则（目录 → 菜单）：

- 只扫描目录（跳过文件）
- 跳过名为 `components` 的目录
- 目录下必须同时存在：
    - `meta.json`
    - `index.vue`
- `meta.json` 必须包含：
    - `title: string`
    - 可选：`order: number`（整数，>=0）

路径生成规则：

- addon 菜单统一带前缀：`/<addonSource>/<addonName>`
    - addon 来自 node_modules：`addonSource="addon"` → `/addon/<addonName>`
    - addon 来自项目本地 addons：`addonSource="app"` → `/app/<addonName>`
- 子目录名会去掉尾部的 `_数字`（例如 `user_1` → `user`）
- 目录名为 `index` 时，表示“继承父级路径”

树结构：

- 子目录形成 `children`
- 同级节点按 `order` 升序排序（缺省为很大值）

### 2) 项目 menus.json

如果存在 `process.cwd()/menus.json`，并且其内容为数组，会被追加到菜单列表中。

（你可以手写固定菜单，或补充 addon 扫描不到的菜单。）

## MenuConfig 结构

每个菜单节点遵循 `MenuConfig`（`befly/types/sync`）：

- `path?: string`
- `name?: string`
- `sort?: number`
- `parentPath?: string`（可选。你不写时会由树结构推导）
- `children?: MenuConfig[]`

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

- 同步时会用 Bun.Glob 进行匹配
- 命中规则的菜单：
    - **不会写入数据库**
    - 并且会在数据库中被**强制删除（不分 state，包括历史禁用数据）**

匹配兼容：`/a/b` 与 `a/b` 都会参与匹配（双候选兜底）。

### 匹配规则（对齐实现）

- `disableMenus` 中：
    - 非字符串会被忽略
    - 会 `trim()`，空字符串会被忽略
    - 每条规则会被编译为 `new Bun.Glob(pattern)`
- 对每个菜单 `path`：
    - 会 `trim()`
    - 同时构造两个候选值参与匹配：
        - `"/a/b"`
        - `"a/b"`
    - 只要任一候选命中任一 pattern，就认为该 path 被禁用

如果当前 Bun 版本不支持 `Bun.Glob.match`，菜单同步会直接抛错中断（因为无法可靠地做 glob 匹配）。

### 常见误删（一定要看）

disableMenus 的效果是“强删”：

- 不仅会让本次同步不插入该菜单
- 还会对数据库里 **所有 state 的历史记录** 执行物理删除（包含 `state=-1` 的历史/禁用数据）

因此写规则时建议：

- 优先用“最小范围”的精确路径（例如 `/addon/admin/login`），确认没问题后再扩大到通配
- 尽量避免过宽的 `/**`（特别是 `/addon/**` 这种）

示例：

```json
{
    "disableMenus": ["**/login", "/addon/admin/**"]
}
```

再给两个“最小示例”（便于你肉眼判断会删什么）：

1. 只禁用单个菜单：

```json
{
    "disableMenus": ["/login"]
}
```

效果：

- `/login` 菜单不会被写入
- 数据库中 path 为 `/login`（以及兼容候选 `login`）的记录会被物理删除

2. 禁用某个 addon 的全部菜单：

```json
{
    "disableMenus": ["/addon/admin/**"]
}
```

效果：

- 所有以 `/addon/admin/` 开头的菜单都会被过滤
- 数据库中对应的历史菜单记录也会被物理删除（不分 state）

## 同步前置条件

只有当数据库存在 `addon_admin_menu` 表时，才会执行菜单同步。
