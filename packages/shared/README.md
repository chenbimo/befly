# Befly Shared

Befly 框架的共享模块，包含跨包共享的工具函数、常量、类型定义和配置。

## 安装

```bash
bun add befly-shared
```

## 类型定义

所有类型统一从 `befly-shared/types` 导入，按功能分类：

| 分类   | 类型                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| 验证   | `ValidateResult`, `SingleResult`, `FieldDefinition`, `FieldRules`             |
| API    | `ResponseResult`, `PaginatedResult`, `ApiCode`, `ErrorMessages`               |
| 数据库 | `DatabaseConfig`, `SqlValue`, `WhereConditions`                               |
| 上下文 | `RequestContext`, `ApiRoute`                                                  |
| 菜单   | `MenuItem`, `MenuTree`                                                        |
| 加密   | `EncodingType`, `HashAlgorithm`, `PasswordHashOptions`                        |
| JWT    | `JwtPayload`, `JwtSignOptions`, `JwtVerifyOptions`, `JwtDecoded`, `JwtHeader` |
| 日志   | `LogLevel`, `LoggerConfig`                                                    |
| 工具   | `DateFormat`, `PaginationParams`, `PaginationResult`                          |
| 表     | `SystemFields`, `BaseTable`, `InsertType`, `UpdateType`, `SelectType`         |
| Addon  | `AddonAuthor`, `AddonConfig`                                                  |
| 通用   | `ReservedFields`, `ExcludeReserved`                                           |

### 响应类型

```typescript
import type { ResponseResult, PaginatedResult, ValidationResult } from 'befly-shared/types';

// API 响应
const result: ResponseResult<{ id: number }> = {
    code: 0,
    msg: '操作成功',
    data: { id: 1 }
};

// 分页响应
const list: PaginatedResult<User> = {
    code: 0,
    msg: '查询成功',
    data: users,
    total: 100,
    page: 1,
    limit: 10,
    pages: 10
};
```

### 常量

```typescript
import { ApiCode, ErrorMessages } from 'befly-shared/types';

// 响应码
ApiCode.SUCCESS; // 0
ApiCode.FAIL; // 1
ApiCode.UNAUTHORIZED; // 401
ApiCode.FORBIDDEN; // 403
ApiCode.NOT_FOUND; // 404
ApiCode.SERVER_ERROR; // 500

// 错误消息
ErrorMessages.UNAUTHORIZED; // '请先登录'
ErrorMessages.FORBIDDEN; // '无访问权限'
ErrorMessages.TOKEN_EXPIRED; // 'Token 已过期'
```

### 配置类型

```typescript
import type { DatabaseConfig, RedisConfig } from 'befly-shared/types';

const dbConfig: DatabaseConfig = {
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'befly'
};

const redisConfig: RedisConfig = {
    host: 'localhost',
    port: 6379,
    password: 'password',
    db: 0
};
```

### Redis 键和 TTL

```typescript
import { RedisKeys, RedisTTL } from 'befly-shared/redisKeys';

// 生成 Redis 键
RedisKeys.apisAll(); // 'befly:apis:all'
RedisKeys.menusAll(); // 'befly:menus:all'
RedisKeys.roleInfo('admin'); // 'befly:role:info:admin'
RedisKeys.roleApis('admin'); // 'befly:role:apis:admin'
RedisKeys.tableColumns('user'); // 'befly:table:columns:user'

// TTL 配置（秒）
RedisTTL.tableColumns; // 3600 (1小时)
RedisTTL.roleApis; // 86400 (24小时)
RedisTTL.roleInfo; // 86400 (24小时)
RedisTTL.apisAll; // null (永久)
RedisTTL.menusAll; // null (永久)
```

## 配置管理

### mergeConfig

加载并合并配置文件（矩阵搜索：dirs × files）。

**参数：**

- `dirs`: 目录数组（绝对路径）
- `files`: 文件名数组（不含扩展名）
- `required`: 是否必填，默认 `false`
- `extensions`: 扩展名数组，默认 `['.js', '.ts', '.json']`

**返回：** `Promise<Record<string, any>>`

**示例：**

```typescript
import { mergeConfig } from 'befly-shared/scanConfig';

const config = await mergeConfig({
    dirs: ['/path/to/config1', '/path/to/config2'],
    files: ['app', 'database'],
    required: false
});
```

### addonConfigMerge

Addon 配置自动合并函数，自动读取 addon 的 `addon.config.js` 和项目 `config/` 目录下的同名配置文件进行合并。

**参数：**

- `options`: 合并选项（可选）

**返回：** `Promise<Record<string, any>>`

**示例：**

```typescript
import { addonConfigMerge } from 'befly-shared/scanConfig';

// 在 @befly-addon/admin 包根目录文件中调用
const config = await addonConfigMerge();
// 自动读取：
// 1. @befly-addon/admin/addon.config.js
// 2. 项目根目录/config/admin.{js,ts,json}
// 3. 合并后返回
```

## 字段名转换

### keysToCamel

将对象字段名转为小驼峰格式。

**参数：**

- `obj`: 源对象

**返回：** `T`

**示例：**

```typescript
import { keysToCamel } from 'befly-shared/keysToCamel';

keysToCamel({ user_id: 123, user_name: 'John' });
// { userId: 123, userName: 'John' }
```

### keysToSnake

将对象字段名转为下划线格式。

**参数：**

- `obj`: 源对象

**返回：** `T`

**示例：**

```typescript
import { keysToSnake } from 'befly-shared/keysToSnake';

keysToSnake({ userId: 123, userName: 'John' });
// { user_id: 123, user_name: 'John' }
```

### arrayKeysToCamel

批量将数组对象的字段名转为小驼峰格式。

**参数：**

- `arr`: 源数组

**返回：** `T[]`

**示例：**

```typescript
import { arrayKeysToCamel } from 'befly-shared/arrayKeysToCamel';

arrayKeysToCamel([
    { user_id: 1, user_name: 'John' },
    { user_id: 2, user_name: 'Jane' }
]);
// [{ userId: 1, userName: 'John' }, { userId: 2, userName: 'Jane' }]
```

## 数据处理

### arrayToTree

将扁平数组转为树形结构。

**参数：**

- `items`: 数组
- `options`: 配置项
    - `idField`: 节点 id 字段名，默认 `'id'`
    - `pidField`: 父节点 id 字段名，默认 `'pid'`
    - `childrenField`: 子节点字段名，默认 `'children'`
    - `rootPid`: 根节点的父 id，默认 `0`
    - `mapFn`: 节点转换函数（可选）

**返回：** `T[]`

**示例：**

```typescript
import { arrayToTree } from 'befly-shared/arrayToTree';

const items = [
    { id: 1, pid: 0, name: '根节点' },
    { id: 2, pid: 1, name: '子节点1' },
    { id: 3, pid: 1, name: '子节点2' }
];

const tree = arrayToTree(items);
// [
//   {
//     id: 1, pid: 0, name: '根节点',
//     children: [
//       { id: 2, pid: 1, name: '子节点1' },
//       { id: 3, pid: 1, name: '子节点2' }
//     ]
//   }
// ]
```

### fieldClear

字段过滤和清理工具，支持字段挑选、排除、值保留、值排除等操作。

**参数：**

- `data`: 数据（对象或数组）
- `options`: 配置项
    - `pickKeys`: 只保留这些字段
    - `omitKeys`: 排除这些字段
    - `keepValues`: 只保留这些值
    - `excludeValues`: 排除这些值
    - `keepMap`: 强制保留的键值对（优先级最高）

**返回：** `FieldClearResult<T>`

**示例：**

```typescript
import { fieldClear } from 'befly-shared/fieldClear';

// 只保留指定字段
fieldClear({ id: 1, name: 'John', age: 30 }, { pickKeys: ['id', 'name'] });
// { id: 1, name: 'John' }

// 排除指定字段
fieldClear({ id: 1, name: 'John', age: 30 }, { omitKeys: ['age'] });
// { id: 1, name: 'John' }

// 排除指定值
fieldClear({ id: 1, name: null, age: undefined }, { excludeValues: [null, undefined] });
// { id: 1 }
```

### pickFields

挑选对象中的指定字段。

**参数：**

- `obj`: 源对象
- `keys`: 字段名数组

**返回：** `Partial<T>`

**示例：**

```typescript
import { pickFields } from 'befly-shared/pickFields';

pickFields({ id: 1, name: 'John', age: 30 }, ['id', 'name']);
// { id: 1, name: 'John' }
```

## 文件扫描

### scanFiles

扫描指定目录下的文件。

**参数：**

- `dir`: 目录路径
- `pattern`: Glob 模式，默认 `'**/*.{ts,js}'`
- `ignoreUnderline`: 是否忽略下划线开头的文件/目录，默认 `true`

**返回：** `Promise<ScanFileResult[]>`

**示例：**

```typescript
import { scanFiles } from 'befly-shared/scanFiles';

const files = await scanFiles('/path/to/dir', '**/*.ts');
// [
//   { filePath: '/path/to/dir/file1.ts', relativePath: 'file1', fileName: 'file1' },
//   { filePath: '/path/to/dir/sub/file2.ts', relativePath: 'sub/file2', fileName: 'file2' }
// ]
```

### scanViews

扫描项目和所有 `@befly-addon` 包的 views 目录，用于 unplugin-vue-router 的 routesFolder 配置。

**注意：** 此函数只能在 vite.config.js 中使用（Node.js 环境），不能在浏览器中使用。

**返回：** 路由文件夹配置数组

**示例：**

```typescript
import { scanViews } from 'befly-shared/scanViews';

// 在 vite.config.js 中使用
export default defineConfig({
    plugins: [
        VueRouter({
            routesFolder: scanViews()
        })
    ]
});
```

### scanAddons

扫描所有可用的 addon，从 `node_modules/@befly-addon/` 加载。

**参数：**

- `cwd`: 项目根目录，默认 `process.cwd()`

**返回：** `string[]` - addon 名称数组

**示例：**

```typescript
import { scanAddons } from 'befly-shared/addonHelper';

const addons = scanAddons();
// ['admin', 'blog', 'shop']
```

## 路由处理

### layouts

自定义布局处理函数，根据文件名后缀判断使用哪个布局。

**参数：**

- `routes`: 原始路由配置
- `inheritLayout`: 继承的布局名称（来自父级目录）

**返回：** 处理后的布局配置

**示例：**

```typescript
import { layouts } from 'befly-shared/layouts';

// 根据文件名后缀判断布局：
// - index.vue -> 默认布局
// - login_n.vue -> n 布局
// - admin_a.vue -> a 布局
```

## 性能工具

### calcPerfTime

计算性能时间差（支持纳秒级精度）。

**参数：**

- `startTime`: 开始时间（纳秒）
- `endTime`: 结束时间（纳秒），默认 `Bun.nanoseconds()`

**返回：** `string` - 格式化的时间字符串

**示例：**

```typescript
import { calcPerfTime } from 'befly-shared/calcPerfTime';

const start = Bun.nanoseconds();
// ... 执行操作 ...
const duration = calcPerfTime(start);
// "12.34 毫秒" 或 "1.23 秒"
```

## Addon 辅助

### addonHelper

提供 addon 相关的辅助功能，包括扫描、路径解析等。

**导出函数：**

- `scanAddons(cwd?)`: 扫描所有可用的 addon
- 其他辅助函数...

## 类型定义

所有类型定义自动生成到 `types/` 目录下，可直接导入使用：

```typescript
import type { LoadConfigOptions, MergeConfigOptions } from 'befly-shared/configTypes';
```

## License

Apache-2.0
