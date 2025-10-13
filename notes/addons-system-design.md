# Befly Addons 组件系统实现方案

## 一、需求概述

在 `tpl` 目录下添加 `addons` 目录，提供用户自定义组件功能。每个组件是独立的目录，支持以下子目录：

-   `apis/` - 接口定义（自动添加组件名前缀）
-   `checks/` - 检查脚本
-   `plugins/` - 插件文件
-   `tables/` - 表定义文件
-   `types/` - 类型定义

## 二、目录结构设计

### 2.1 Addons 目录结构

```
tpl/
├── addons/                    # 组件根目录
│   ├── payment/              # 支付组件示例
│   │   ├── apis/             # 接口目录
│   │   │   ├── create.ts     # 创建支付订单
│   │   │   └── query.ts      # 查询支付状态
│   │   ├── checks/           # 检查目录
│   │   │   └── payment.ts    # 支付相关检查
│   │   ├── plugins/          # 插件目录
│   │   │   └── alipay.ts     # 支付宝插件
│   │   ├── tables/           # 表定义目录
│   │   │   └── order.json    # 订单表
│   │   └── types/            # 类型定义目录
│   │       └── index.d.ts    # 类型定义
│   ├── sms/                  # 短信组件示例
│   │   ├── apis/
│   │   │   └── send.ts       # 发送短信
│   │   ├── plugins/
│   │   │   └── sms.ts        # 短信插件
│   │   └── tables/
│   │       └── smsLog.json   # 短信日志表
│   └── _template/            # 组件模板（以_开头，不加载）
│       ├── apis/
│       ├── checks/
│       ├── plugins/
│       ├── tables/
│       └── README.md
```

### 2.2 组件命名规则

1. **组件目录名：** 小驼峰命名，如 `payment`, `smsService`, `userCenter`
2. **跳过规则：** 以 `_` 开头的目录不加载，如 `_template`, `_disabled`
3. **API 路由前缀：** 自动添加组件名，如 `payment/create.ts` → `/api/payment/create`
4. **表名前缀：** 自动添加组件名，如 `order.json` → `payment_order` 表

## 三、核心功能实现

### 3.1 系统工具函数扩展 (core/system.ts)

新增辅助函数：

```typescript
/**
 * 获取 addons 目录路径
 */
export const getAddonsDir = (): string => {
    return path.join(projectDir, 'addons');
};

/**
 * 扫描所有可用的 addon
 * @returns addon 名称数组
 */
export const scanAddons = (): string[] => {
    const addonsDir = getAddonsDir();
    if (!fs.existsSync(addonsDir)) return [];

    return fs.readdirSync(addonsDir).filter((name) => {
        const fullPath = path.join(addonsDir, name);
        const isDir = fs.statSync(fullPath).isDirectory();
        const notSkip = !name.startsWith('_'); // 跳过 _ 开头的目录
        return isDir && notSkip;
    });
};

/**
 * 获取 addon 的指定子目录路径
 */
export const getAddonDir = (addonName: string, subDir: string): string => {
    return path.join(getAddonsDir(), addonName, subDir);
};
```

### 3.2 检查器扩展 (core/lifecycle/checker.ts)

修改检查流程，支持加载 addons 中的检查文件：

```typescript
// 执行顺序：
// 1. core/checks - 核心检查
// 2. tpl/checks - 项目检查
// 3. tpl/addons/*/checks - 组件检查

// 伪代码
async function runChecks() {
    // 1. 核心检查
    await runCoreChecks();

    // 2. 项目检查
    await runProjectChecks();

    // 3. Addons 检查
    const addons = scanAddons();
    for (const addon of addons) {
        const checksDir = getAddonDir(addon, 'checks');
        if (fs.existsSync(checksDir)) {
            await runAddonChecks(addon, checksDir);
        }
    }
}
```

### 3.3 加载器扩展 (core/lifecycle/loader.ts)

#### 3.3.1 插件加载

```typescript
// 插件加载顺序：
// 1. core/plugins - 核心插件（优先级最高）
// 2. tpl/addons/*/plugins - 组件插件（中等优先级）
// 3. tpl/plugins - 项目插件（优先级最低）

async function loadPlugins() {
    const plugins = [];

    // 1. 加载核心插件
    plugins.push(...(await loadCorePlugins()));

    // 2. 加载 Addons 插件
    const addons = scanAddons();
    for (const addon of addons) {
        const pluginsDir = getAddonDir(addon, 'plugins');
        if (fs.existsSync(pluginsDir)) {
            const addonPlugins = await loadAddonPlugins(addon, pluginsDir);
            plugins.push(...addonPlugins);
        }
    }

    // 3. 加载项目插件
    plugins.push(...(await loadProjectPlugins()));

    return sortPlugins(plugins);
}
```

#### 3.3.2 API 加载

```typescript
// API 加载顺序：
// 1. core/apis - 核心 API
// 2. tpl/addons/*/apis - 组件 API（自动添加前缀）
// 3. tpl/apis - 项目 API

async function loadApis() {
    const apis = [];

    // 1. 加载核心 API
    apis.push(...(await loadCoreApis()));

    // 2. 加载 Addons API
    const addons = scanAddons();
    for (const addon of addons) {
        const apisDir = getAddonDir(addon, 'apis');
        if (fs.existsSync(apisDir)) {
            // 关键：为 addon API 添加路由前缀
            const addonApis = await loadAddonApis(addon, apisDir);
            // 路由格式：/api/{addonName}/{apiPath}
            apis.push(
                ...addonApis.map((api) => ({
                    ...api,
                    route: `/api/${addon}/${api.route.replace(/^\/api\//, '')}`
                }))
            );
        }
    }

    // 3. 加载项目 API
    apis.push(...(await loadProjectApis()));

    return apis;
}
```

### 3.4 数据库同步扩展 (core/scripts/syncDb.ts)

支持同步 addons 中的表定义：

```typescript
// 表同步顺序：
// 1. core/tables - 核心表（添加 sys_ 前缀）
// 2. tpl/addons/*/tables - 组件表（添加 {addonName}_ 前缀）
// 3. tpl/tables - 项目表（无前缀）

async function syncTables() {
    const tablesGlob = new Bun.Glob('*.json');

    // 1. 同步核心表
    const coreDir = __dirtables;
    await syncTablesFromDir(coreDir, 'sys_');

    // 2. 同步 Addons 表
    const addons = scanAddons();
    for (const addon of addons) {
        const tablesDir = getAddonDir(addon, 'tables');
        if (fs.existsSync(tablesDir)) {
            // 表名格式：{addonName}_{tableName}
            await syncTablesFromDir(tablesDir, `${addon}_`);
        }
    }

    // 3. 同步项目表
    const projectDir = getProjectDir('tables');
    await syncTablesFromDir(projectDir, '');
}

async function syncTablesFromDir(dir: string, prefix: string) {
    for await (const file of tablesGlob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
        const fileName = path.basename(file, '.json');

        // 跳过 _ 开头的文件
        if (fileName.startsWith('_')) continue;

        const tableName = prefix + toSnakeTableName(fileName);
        const tableDefinition = await Bun.file(file).json();

        await createOrUpdateTable(tableName, tableDefinition);
    }
}
```

## 四、使用示例

### 4.1 创建支付组件

**目录结构：**

```
tpl/addons/payment/
├── apis/
│   ├── create.ts          # 创建支付订单
│   ├── query.ts           # 查询支付状态
│   └── notify.ts          # 支付回调
├── checks/
│   └── payment.ts         # 支付配置检查
├── plugins/
│   ├── alipay.ts          # 支付宝插件
│   └── wechat.ts          # 微信支付插件
├── tables/
│   ├── order.json         # 订单表
│   └── refund.json        # 退款表
└── types/
    └── index.d.ts         # 类型定义
```

### 4.2 API 示例 (payment/apis/create.ts)

```typescript
import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';

export default Api('创建支付订单', {
    method: 'POST',
    auth: true,
    fields: {
        amount: '金额|number|1|999999999|null|0|null',
        subject: '标题|string|1|100|null|0|null',
        body: '描述|string|0|500|null|0|null'
    },
    required: ['amount', 'subject'],
    handler: async (befly: BeflyContext, ctx: RequestContext) => {
        // 访问支付宝插件
        const alipay = befly.alipay;

        // 创建订单
        const orderId = await befly.db.insData({
            table: 'payment_order', // addon 表名：{addon}_{table}
            data: {
                userId: ctx.jwt.userId,
                amount: ctx.body.amount,
                subject: ctx.body.subject,
                body: ctx.body.body,
                status: 'pending'
            }
        });

        // 调用支付宝
        const payUrl = await alipay.createOrder({
            orderId,
            amount: ctx.body.amount,
            subject: ctx.body.subject
        });

        return Yes('订单创建成功', { orderId, payUrl });
    }
});
```

**路由：** `POST /api/payment/create`

### 4.3 插件示例 (payment/plugins/alipay.ts)

```typescript
import type { BeflyPlugin } from 'befly/types';

export default {
    name: 'alipay',
    version: '1.0.0',
    priority: 100,

    async onLoad(befly) {
        befly.logger.info('支付宝插件加载中...');
    },

    async onInit(befly) {
        // 初始化支付宝 SDK
        befly.alipay = {
            async createOrder(params) {
                // 支付宝下单逻辑
                return 'https://alipay.com/pay?order_id=' + params.orderId;
            }
        };

        befly.logger.info('支付宝插件初始化完成');
    }
} as BeflyPlugin;
```

### 4.4 表定义示例 (payment/tables/order.json)

```json
{
    "userId": "用户ID|number|1|9999999|0|1|null",
    "orderNo": "订单号|string|10|50|''|1|null",
    "amount": "金额|number|1|999999999|0|1|null",
    "subject": "标题|string|1|100|''|0|null",
    "body": "描述|string|0|500|''|0|null",
    "status": "状态|string|1|20|pending|1|^(pending|paid|failed|refunded)$",
    "payType": "支付方式|string|1|20|alipay|1|^(alipay|wechat|bank)$",
    "payTime": "支付时间|number|0|9999999999999|0|0|null",
    "notifyUrl": "回调地址|string|0|500|''|0|null"
}
```

**数据库表名：** `payment_order`

### 4.5 检查示例 (payment/checks/payment.ts)

```typescript
import { Logger } from 'befly/utils/logger';

export default async function (): Promise<boolean> {
    try {
        // 检查支付配置
        const alipayConfig = process.env.ALIPAY_APP_ID;

        if (!alipayConfig) {
            Logger.warn('未配置支付宝 APP_ID，支付功能可能无法使用');
        }

        Logger.info('支付组件检查通过');
        return true;
    } catch (error) {
        Logger.error('支付组件检查失败:', error);
        return false;
    }
}
```

## 五、实现步骤

### 步骤 1：扩展 system.ts

-   添加 `getAddonsDir()`
-   添加 `scanAddons()`
-   添加 `getAddonDir()`

### 步骤 2：修改 checker.ts

-   在项目检查后添加 addons 检查循环
-   记录每个 addon 的检查结果

### 步骤 3：修改 loader.ts

-   在插件加载流程中添加 addons 插件加载
-   在 API 加载流程中添加 addons API 加载
-   为 addon API 添加路由前缀

### 步骤 4：修改 syncDb.ts

-   在表同步流程中添加 addons 表扫描
-   为 addon 表添加表名前缀

### 步骤 5：创建示例 addon

-   创建 `tpl/addons/_template` 模板目录
-   创建 `tpl/addons/demo` 演示组件

### 步骤 6：编写文档

-   更新 docs 中的组件开发文档
-   添加 addon 开发最佳实践

## 六、关键设计决策

### 6.1 加载顺序

**原则：** 核心 > 组件 > 项目

-   **核心优先：** 确保核心功能不被覆盖
-   **组件次之：** 组件功能可被项目覆盖
-   **项目最后：** 项目代码拥有最终决定权

### 6.2 命名规则

**API 路由：**

-   核心 API：`/api/{category}/{name}`
-   组件 API：`/api/{addon}/{name}`
-   项目 API：`/api/{category}/{name}`

**数据库表：**

-   核心表：`sys_{table}`
-   组件表：`{addon}_{table}`
-   项目表：`{table}`

**插件名称：**

-   建议格式：`{addon}.{plugin}`
-   示例：`payment.alipay`, `sms.tencent`

### 6.3 跳过规则

以下目录/文件将被跳过：

-   目录名以 `_` 开头：如 `_template`, `_disabled`
-   文件名以 `_` 开头：如 `_common.json`, `_utils.ts`
-   空目录：没有任何文件的目录

### 6.4 冲突处理

**插件名称冲突：**

-   核心插件优先级最高
-   后加载的插件覆盖先加载的
-   建议使用命名空间避免冲突

**API 路由冲突：**

-   因为有前缀隔离，理论上不会冲突
-   同一 addon 内不能有同名 API

**表名冲突：**

-   因为有前缀隔离，理论上不会冲突
-   不同 addon 可以有同名表定义文件

## 七、优势和特点

### 7.1 优势

1. **模块化：** 每个 addon 是独立的功能模块
2. **可插拔：** 可以随时添加或删除 addon
3. **隔离性：** 通过前缀避免命名冲突
4. **复用性：** addon 可以在不同项目间共享
5. **扩展性：** 不修改核心代码即可扩展功能

### 7.2 适用场景

-   **支付集成：** 支付宝、微信支付、银行支付
-   **短信服务：** 阿里云、腾讯云短信
-   **文件存储：** OSS、COS、MinIO
-   **社交登录：** 微信、QQ、GitHub
-   **数据统计：** 访问统计、用户行为分析
-   **内容管理：** 文章、商品、评论系统

## 八、注意事项

### 8.1 性能考虑

-   **按需加载：** 只加载项目实际使用的 addon
-   **缓存策略：** 扫描结果可以缓存
-   **异步加载：** 使用异步方式加载 addon

### 8.2 安全考虑

-   **权限隔离：** addon 不应访问其他 addon 的数据
-   **配置验证：** addon 的配置需要验证
-   **错误隔离：** 一个 addon 出错不应影响其他功能

### 8.3 开发建议

-   **命名规范：** 使用清晰的 addon 名称
-   **文档完善：** 每个 addon 应有 README
-   **版本管理：** addon 应有版本信息
-   **测试覆盖：** 为 addon 编写测试

## 九、路线图

### 阶段 1：基础功能（当前）

-   ✅ 目录结构设计
-   ⏳ 扩展 system.ts
-   ⏳ 修改 checker.ts
-   ⏳ 修改 loader.ts
-   ⏳ 修改 syncDb.ts

### 阶段 2：示例和文档

-   ⏳ 创建 addon 模板
-   ⏳ 创建演示 addon
-   ⏳ 编写开发文档
-   ⏳ 编写最佳实践

### 阶段 3：增强功能

-   ⏳ Addon 依赖管理
-   ⏳ Addon 版本检查
-   ⏳ Addon 配置界面
-   ⏳ Addon 市场

## 十、总结

Addons 组件系统为 Befly 框架提供了强大的扩展能力，通过标准化的目录结构和加载机制，使得功能模块化、可插拔、易复用。这将极大地提升开发效率和代码复用性。
