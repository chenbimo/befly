# Befly Addon 模板

这是一个 Befly Addon 的标准模板，以 `_` 开头的目录会被框架自动跳过，不会被加载。

## 目录结构

```
_template/
├── README.md           # 本文档
├── apis/              # API 接口目录
│   └── example.ts     # 示例接口
├── checks/            # 检查脚本目录
│   └── example.ts     # 示例检查
├── plugins/           # 插件目录
│   └── example.ts     # 示例插件
├── tables/            # 表定义目录
│   └── example.json   # 示例表定义
├── types/             # 类型定义目录
│   └── index.d.ts     # 类型定义文件
└── config/            # 配置目录
    └── default.ts     # 默认配置文件
```

## 使用方法

1. 复制此模板目录到 `tpl/addons/` 下
2. 重命名为你的组件名（小驼峰命名，如 `payment`、`smsService`）
3. 根据需要删除不需要的子目录
4. 实现你的功能代码

## 命名规则

### 组件目录名

- 使用小驼峰命名：`payment`、`userCenter`、`smsService`
- 以 `_` 开头的目录会被跳过：`_template`、`_disabled`

### API 路由

- 自动添加组件名前缀：`/api/{组件名}/{API路径}`
- 示例：`payment/apis/create.ts` → `POST /api/payment/create`

### 数据库表名

- 自动添加组件名前缀：`{组件名}_{表名}`
- 示例：`payment/tables/order.json` → `payment_order` 表

### 插件名称

- 自动添加组件名前缀：`{组件名}.{插件名}`
- 示例：`payment/plugins/alipay.ts` → `payment.alipay` 插件

## 子目录说明

### apis/ - API 接口

存放组件的 HTTP API 接口定义，使用 `Api()` 函数创建。

**特点：**

- 路由自动添加 `/api/{组件名}/` 前缀
- 可以访问所有已加载的插件

### checks/ - 检查脚本

存放组件的启动检查脚本，在框架启动前执行。

**要求：**

- 必须使用 `export default` 导出函数
- 函数返回 `true`（通过）或 `false`（失败）
- 检查失败会阻止框架启动

### plugins/ - 插件

存放组件的插件，用于扩展 befly 对象功能。

**特点：**

- 插件名自动添加组件名前缀
- 可以注册中间件、扩展 befly 对象等
- 加载顺序：核心 → addons → 项目

### tables/ - 表定义

存放组件的数据库表定义（JSON 格式）。

**特点：**

- 表名自动添加组件名前缀
- 使用 `bun syncDb` 自动同步到数据库
- 支持字段规则定义（类型、长度、默认值等）

### types/ - 类型定义

存放组件的 TypeScript 类型定义。

**建议：**

- 统一导出到 `index.d.ts`
- 声明全局类型时使用 `declare global`

### config/ - 配置文件

存放组件的配置文件，通常在插件初始化时加载。

**建议：**

- 配置项从环境变量读取
- 提供合理的默认值
- 在插件的 `onInit` 中加载配置

## 开发建议

1. **保持独立性**：组件应该是自包含的，尽量减少对其他组件的依赖
2. **环境变量**：使用 `{ADDON_NAME}_{CONFIG_KEY}` 格式命名
3. **错误处理**：使用 `Logger` 统一记录错误，关键错误使用 `process.exit(1)` 退出
4. **日志记录**：使用 `Logger` 记录关键操作
5. **测试覆盖**：为组件编写测试用例

## 示例

参考 `tpl/addons/demo/` 目录下的完整示例。
