# Befly 3.0 TypeScript 示例项目

这是一个完整的 Befly 3.0 TypeScript 项目示例，展示了如何使用框架的所有 TypeScript 特性。

## 📁 项目结构

```
tpl/
├── types/              # 类型定义
│   ├── index.ts        # 导出所有类型
│   ├── models.ts       # 数据模型类型
│   └── api.ts          # API 请求/响应类型
├── apis/               # API 接口
│   ├── user/
│   │   ├── login.ts    # 用户登录（公开）
│   │   └── list.ts     # 用户列表（需管理员权限）
│   └── article/
│       ├── create.ts   # 创建文章（需登录）
│       └── list.ts     # 文章列表（公开）
├── tables/             # 表定义（JSON 格式）
├── plugins/            # 自定义插件
├── tests/              # 测试文件
├── main.ts             # 项目入口
├── tsconfig.json       # TypeScript 配置
└── package.json        # 项目配置
```

## 🚀 快速开始

### 安装依赖

```bash
bun install
```

### 启动开发服务器

```bash
bun run dev
```

服务器将在 `http://localhost:3000` 启动。

## 📝 核心特性示例

### 1. 类型定义

项目使用完整的 TypeScript 类型定义，包括：

-   **数据模型类型**（`types/models.ts`）
-   **API 请求/响应类型**（`types/api.ts`）
-   **继承 Befly 核心类型**（从 `befly/types` 导入）

### 2. 类型安全的 API 开发

```typescript
import { Api, Yes, No } from 'befly';
import type { BeflyContext, RequestContext } from 'befly/types';
import type { LoginRequest, LoginResponse } from '../types/api';

export default Api.POST(
    '用户登录',
    false,
    {
        /* 字段定义 */
    },
    ['username', 'password'],
    async (befly: BeflyContext, ctx: RequestContext) => {
        const { username, password } = ctx.body as LoginRequest;

        // 类型安全的数据库查询
        const user = await befly.db.getDetail<User>({
            table: 'user',
            where: { username }
        });

        return Yes<LoginResponse>('登录成功', response);
    }
);
```

### 3. 数据库操作

所有数据库操作都支持泛型：

```typescript
// 查询单条
const user = await befly.db.getDetail<User>({
    table: 'user',
    where: { id: 1 }
});

// 查询列表
const result = await befly.db.getList<Article>({
    table: 'article',
    page: 1,
    limit: 10
});

// 插入数据
const articleId = await befly.db.insData({
    table: 'article',
    data: { title: '标题', content: '内容' }
});
```

### 4. 认证与权限

```typescript
// 公开接口
export default Api.POST('接口名', false, ...);

// 需要登录
export default Api.POST('接口名', true, ...);

// 需要特定角色
export default Api.POST('接口名', ['admin', 'editor'], ...);
```

### 5. JWT 认证

```typescript
import { Jwt } from 'befly/utils/jwt';

// 生成 Token
const token = await Jwt.sign({ userId: '123', role: 'admin' }, { expiresIn: '7d' });

// 验证 Token
const payload = await Jwt.verify(token, secret);

// 检查权限
const hasAdmin = Jwt.hasRole(payload, 'admin');
```

## 📋 示例接口

### 用户相关

-   `POST /user/login` - 用户登录（公开）
-   `POST /user/list` - 获取用户列表（仅管理员）

### 文章相关

-   `POST /article/create` - 创建文章（需登录）
-   `POST /article/list` - 获取文章列表（公开）

## 🧪 测试

运行测试：

```bash
bun test
```

## 📚 相关文档

-   [TypeScript 支持指南](../docs/10-TypeScript/01-TypeScript支持.md)
-   [类型定义参考](../docs/10-TypeScript/02-类型定义参考.md)
-   [最佳实践](../docs/10-TypeScript/03-最佳实践.md)
-   [迁移指南](../docs/10-TypeScript/04-迁移指南.md)

## 💡 提示

1. **智能提示**：使用 VS Code 可获得完整的类型提示和自动补全
2. **类型检查**：TypeScript 会在编译时捕获大部分错误
3. **重构友好**：修改类型定义时，所有使用处会自动更新
4. **文档即代码**：类型定义本身就是最好的文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License
