# TypeScript 支持

Befly 3.0 完全使用 TypeScript 重写，提供完整的类型安全和开发体验。

## 为什么选择 TypeScript？

### 1. 类型安全

```typescript
// ❌ JavaScript - 运行时错误
const user = { name: 'test' };
user.age.toString(); // TypeError: Cannot read property 'toString' of undefined

// ✅ TypeScript - 编译时错误
const user = { name: 'test' };
user.age.toString(); // 编译错误：Property 'age' does not exist
```

### 2. 智能提示

TypeScript 提供完整的 IDE 智能提示：

```typescript
import { Api, Yes, No } from 'befly';

export default Api.POST(
    '创建用户',
    true, // auth - 自动提示 boolean | string[]
    {
        username: '用户名⚡string⚡3⚡20⚡null⚡0⚡null'
        // 输入字段规则时有完整的提示
    },
    ['username'], // required - 自动提示字段名
    async (befly, ctx) => {
        // befly 参数有完整的类型定义
        befly.db.getList(); // 自动提示所有方法
        return Yes('成功'); // 自动提示参数类型
    }
);
```

### 3. 重构支持

- **安全重命名**：重命名变量/函数时自动更新所有引用
- **查找引用**：快速找到所有使用位置
- **跳转定义**：Ctrl+点击跳转到定义
- **类型推导**：自动推导变量类型

### 4. Bun 原生支持

Befly 使用 Bun 运行时，原生支持 TypeScript：

- ✅ **零配置**：无需 tsc 编译
- ✅ **高性能**：原生 TS 解析
- ✅ **即时运行**：直接运行 .ts 文件
- ✅ **类型检查**：编辑时实时检查

## 核心类型定义

### BeflyContext（应用上下文）

```typescript
import type { BeflyContext } from 'befly/types';

// BeflyContext 包含所有插件提供的功能
interface BeflyContext {
    // 数据库管理器
    db: SqlHelper;

    // Redis 助手
    redis: typeof RedisHelper;

    // 日志记录器
    logger: typeof Logger;

    // 数据工具
    tool: Tool;

    // 其他自定义插件...
}
```

### ApiRoute（API 路由）

```typescript
import type { ApiRoute, ApiHandler } from 'befly/types';

// API 路由定义
interface ApiRoute {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
    name: string;
    auth: boolean | string[];
    fields: Record<string, string>;
    required: string[];
    handler: ApiHandler;
}

// API 处理器函数
type ApiHandler = (befly: BeflyContext, ctx: RequestContext, req: Request) => Promise<ApiResponse>;
```

### SqlHelper（数据库管理器）

```typescript
import type { SqlHelper, QueryOptions, ListResult } from 'befly/utils';

// 查询选项
interface QueryOptions {
    table: string;
    fields?: string[];
    where?: WhereConditions;
    orderBy?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
}

// 列表结果（泛型）
interface ListResult<T = any> {
    list: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

// 使用示例
const result = await befly.db.getList<User>({
    table: 'user',
    where: { state: { $gt: 0 } },
    page: 1,
    limit: 10
});

// result.list 的类型为 User[]
result.list.forEach((user) => {
    console.log(user.username); // 类型安全
});
```

### RedisHelper（Redis 助手）

```typescript
import type { RedisHelper } from 'befly/utils';

// 泛型方法
await befly.redis.setObject<User>('user:123', {
    id: 123,
    username: 'test',
    email: 'test@example.com'
});

const user = await befly.redis.getObject<User>('user:123');
// user 的类型为 User | null
```

### Validator（数据验证器）

```typescript
import { Validator } from 'befly/utils';
import type { ValidationResult } from 'befly/types';

const result: ValidationResult = Validator.validate('testuser', '用户名⚡string⚡3⚡20⚡null⚡0⚡null');

if (Validator.isPassed(result)) {
    console.log('验证通过:', result.value);
} else {
    console.log('验证失败:', result.errors);
}
```

## 类型安全的 API 开发

### 定义接口

```typescript
import { Api, Yes, No } from 'befly';
import type { BeflyContext } from 'befly/types';

// 定义请求参数接口
interface CreateUserParams {
    username: string;
    email: string;
    password: string;
}

// 定义响应数据接口
interface UserResponse {
    id: number;
    username: string;
    email: string;
    createdAt: number;
}

export default Api.POST(
    '创建用户',
    false,
    {
        username: '用户名⚡string⚡3⚡20⚡null⚡1⚡^[a-zA-Z0-9_]+$',
        email: '邮箱⚡string⚡5⚡100⚡null⚡1⚡^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        password: '密码⚡string⚡6⚡50⚡null⚡0⚡null'
    },
    ['username', 'email', 'password'],
    async (befly: BeflyContext, ctx: any) => {
        try {
            // 类型安全的数据访问
            const params = ctx.body as CreateUserParams;

            // 插入数据
            const userId = await befly.db.insData({
                table: 'user',
                data: {
                    username: params.username,
                    email: params.email,
                    password: await befly.tool.hashPassword(params.password)
                }
            });

            // 查询新用户
            const user = await befly.db.getOne<UserResponse>({
                table: 'user',
                where: { id: userId }
            });

            return Yes<UserResponse>('创建成功', user!);
        } catch (error: any) {
            befly.logger.error({
                msg: '创建用户失败',
                error: error.message
            });
            return No('创建失败', { error: error.message });
        }
    }
);
```

### 使用泛型

```typescript
// 定义用户类型
interface User {
    id: number;
    username: string;
    email: string;
    createdAt: number;
}

// 类型安全的查询
const users = await befly.db.getList<User>({
    table: 'user',
    where: { state: 1 },
    limit: 10
});

// users.list 类型为 User[]
users.list.forEach((user) => {
    console.log(user.username); // ✅ 类型安全
    console.log(user.password); // ❌ 编译错误：Property 'password' does not exist
});

// 类型安全的缓存
await befly.redis.setObject<User>('user:123', user);
const cachedUser = await befly.redis.getObject<User>('user:123');
```

## 配置环境

### tsconfig.json

Befly 使用严格的 TypeScript 配置：

```json
{
    "compilerOptions": {
        "target": "ESNext",
        "module": "ESNext",
        "lib": ["ESNext"],
        "moduleResolution": "bundler",
        "types": ["bun-types"],
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "allowSyntheticDefaultImports": true,
        "isolatedModules": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "allowJs": true
    }
}
```

### package.json

```json
{
    "name": "my-befly-app",
    "type": "module",
    "dependencies": {
        "befly": "^3.0.0"
    },
    "devDependencies": {
        "@types/bun": "latest"
    }
}
```

## 最佳实践

### 1. 定义接口类型

```typescript
// ✅ 好的做法
interface CreateUserParams {
    username: string;
    email: string;
    password: string;
}

const params: CreateUserParams = ctx.body;

// ❌ 避免使用 any
const params: any = ctx.body;
```

### 2. 使用泛型

```typescript
// ✅ 好的做法
const users = await befly.db.getList<User>({ table: 'user' });

// ❌ 失去类型信息
const users = await befly.db.getList({ table: 'user' });
```

### 3. 类型守卫

```typescript
// 使用类型守卫确保类型安全
function isUser(obj: any): obj is User {
    return obj && typeof obj.id === 'number' && typeof obj.username === 'string' && typeof obj.email === 'string';
}

const data = await befly.redis.getObject('user:123');
if (isUser(data)) {
    console.log(data.username); // ✅ 类型安全
}
```

### 4. 避免类型断言

```typescript
// ❌ 避免强制断言
const user = ctx.body as User; // 不安全

// ✅ 使用验证
const result = Validator.validate(ctx.body, rules);
if (Validator.isPassed(result)) {
    const user = result.value; // 安全
}
```

## 迁移指南

### 从 JavaScript 迁移到 TypeScript

1. **重命名文件**：`.js` → `.ts`

2. **添加类型导入**：

```typescript
import type { BeflyContext } from 'befly/types';
```

3. **添加参数类型**：

```typescript
// Before
async (befly, ctx) => {};

// After
async (befly: BeflyContext, ctx: any) => {};
```

4. **定义接口**：

```typescript
interface MyData {
    id: number;
    name: string;
}
```

5. **使用泛型**：

```typescript
const data = await befly.db.getList<MyData>({ table: 'my_table' });
```

## 工具支持

### VS Code

推荐的 VS Code 扩展：

- **Bun for Visual Studio Code** - Bun 支持
- **Error Lens** - 实时显示错误
- **Pretty TypeScript Errors** - 美化错误信息

### 配置

`.vscode/settings.json`：

```json
{
    "typescript.tsdk": "node_modules/typescript/lib",
    "typescript.enablePromptUseWorkspaceTsdk": true,
    "editor.codeActionsOnSave": {
        "source.organizeImports": true
    }
}
```

## 常见问题

### Q: Bun 运行 TypeScript 需要编译吗？

**A**: 不需要。Bun 原生支持 TypeScript，可以直接运行 `.ts` 文件。

### Q: 如何查看类型定义？

**A**: 在 VS Code 中，Ctrl+点击任何类型或函数即可跳转到定义。

### Q: 类型错误如何解决？

**A**:

1. 检查类型定义是否正确
2. 使用类型断言（谨慎）
3. 查看错误提示的详细信息
4. 使用 `// @ts-ignore` 临时忽略（不推荐）

### Q: 可以混用 JS 和 TS 吗？

**A**: 可以。Befly 支持 `.js` 和 `.ts` 文件混用，通过 `allowJs: true` 配置。

## 更多资源

- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [Bun TypeScript 支持](https://bun.sh/docs/typescript)
- [Befly 类型定义](../types/)
- [示例项目](../examples/)
