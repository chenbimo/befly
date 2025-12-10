# 实战示例

> 完整的 CRUD 模块开发示例

## 目录

- [用户管理模块](#用户管理模块)
- [文章管理模块](#文章管理模块)
- [文件上传](#文件上传)
- [数据导出](#数据导出)

---

## 用户管理模块

一个完整的用户管理模块，包含注册、登录、信息获取、更新、列表查询。

### 表定义

`tables/user.json`：

```json
{
    "email": "邮箱|string|5|100||true|@email",
    "password": "密码|string|6|100||true",
    "nickname": "昵称|string|2|50|用户",
    "avatar": "头像|string|0|500",
    "phone": "手机号|string|0|20||false|@phone",
    "gender": "性别|number|0|2|0",
    "birthday": "生日|string|0|10",
    "bio": "简介|string|0|500",
    "role": "角色|string|2|20|user",
    "login_count": "登录次数|number|0||0",
    "last_login_at": "最后登录|number|0||"
}
```

### 用户注册

`apis/user/register.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '用户注册',
    method: 'POST',
    auth: false,
    fields: {
        email: { name: '邮箱', type: 'string', min: 5, max: 100, regexp: '@email' },
        password: { name: '密码', type: 'string', min: 6, max: 100 },
        nickname: { name: '昵称', type: 'string', min: 2, max: 50 }
    },
    required: ['email', 'password'],
    handler: async (befly, ctx) => {
        // 检查邮箱是否已存在
        const exists = await befly.db.getDetail({
            table: 'user',
            columns: ['id'],
            where: { email: ctx.body.email }
        });

        if (exists?.id) {
            return No('该邮箱已被注册');
        }

        // 加密密码
        const hashedPassword = await befly.cipher.hashPassword(ctx.body.password);

        // 创建用户
        const result = await befly.db.insData({
            table: 'user',
            data: {
                email: ctx.body.email,
                password: hashedPassword,
                nickname: ctx.body.nickname || '用户'
            }
        });

        return Yes('注册成功', { id: result.insertId });
    }
} as ApiRoute;
```

### 用户登录

`apis/user/login.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '用户登录',
    method: 'POST',
    auth: false,
    fields: {
        email: { name: '邮箱', type: 'string', min: 5, max: 100, regexp: '@email' },
        password: { name: '密码', type: 'string', min: 6, max: 100 }
    },
    required: ['email', 'password'],
    handler: async (befly, ctx) => {
        // 查询用户
        const user = await befly.db.getDetail({
            table: 'user',
            columns: ['id', 'email', 'password', 'nickname', 'avatar', 'role', 'state'],
            where: { email: ctx.body.email }
        });

        if (!user?.id) {
            return No('用户不存在');
        }

        if (user.state !== 1) {
            return No('账户已被禁用');
        }

        // 验证密码
        const isValid = await befly.cipher.verifyPassword(ctx.body.password, user.password);
        if (!isValid) {
            return No('密码错误');
        }

        // 更新登录信息
        await befly.db.updData({
            table: 'user',
            data: {
                loginCount: user.loginCount + 1,
                lastLoginAt: Date.now()
            },
            where: { id: user.id }
        });

        // 签发令牌
        const token = befly.jwt.sign({
            userId: user.id,
            role: user.role
        });

        return Yes('登录成功', {
            token: token,
            user: {
                id: user.id,
                email: user.email,
                nickname: user.nickname,
                avatar: user.avatar,
                role: user.role
            }
        });
    }
} as ApiRoute;
```

### 获取用户信息

`apis/user/info.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '获取用户信息',
    method: 'GET',
    auth: true,
    handler: async (befly, ctx) => {
        const user = await befly.db.getDetail({
            table: 'user',
            columns: ['id', 'email', 'nickname', 'avatar', 'phone', 'gender', 'birthday', 'bio', 'role', 'createdAt'],
            where: { id: ctx.user.userId }
        });

        if (!user?.id) {
            return No('用户不存在');
        }

        return Yes('获取成功', user);
    }
} as ApiRoute;
```

### 更新用户信息

`apis/user/update.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '更新用户信息',
    method: 'POST',
    auth: true,
    fields: {
        nickname: { name: '昵称', type: 'string', min: 2, max: 50 },
        avatar: { name: '头像', type: 'string', max: 500 },
        phone: { name: '手机号', type: 'string', max: 20, regexp: '@phone' },
        gender: { name: '性别', type: 'number', min: 0, max: 2 },
        birthday: { name: '生日', type: 'string', max: 10 },
        bio: { name: '简介', type: 'string', max: 500 }
    },
    handler: async (befly, ctx) => {
        const updateData: Record<string, any> = {};

        // 只更新提交的字段
        if (ctx.body.nickname !== undefined) updateData.nickname = ctx.body.nickname;
        if (ctx.body.avatar !== undefined) updateData.avatar = ctx.body.avatar;
        if (ctx.body.phone !== undefined) updateData.phone = ctx.body.phone;
        if (ctx.body.gender !== undefined) updateData.gender = ctx.body.gender;
        if (ctx.body.birthday !== undefined) updateData.birthday = ctx.body.birthday;
        if (ctx.body.bio !== undefined) updateData.bio = ctx.body.bio;

        if (Object.keys(updateData).length === 0) {
            return No('没有需要更新的字段');
        }

        await befly.db.updData({
            table: 'user',
            data: updateData,
            where: { id: ctx.user.userId }
        });

        return Yes('更新成功');
    }
} as ApiRoute;
```

### 修改密码

`apis/user/changePassword.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '修改密码',
    method: 'POST',
    auth: true,
    fields: {
        oldPassword: { name: '原密码', type: 'string', min: 6, max: 100 },
        newPassword: { name: '新密码', type: 'string', min: 6, max: 100 }
    },
    required: ['oldPassword', 'newPassword'],
    handler: async (befly, ctx) => {
        // 获取用户密码
        const user = await befly.db.getDetail({
            table: 'user',
            columns: ['id', 'password'],
            where: { id: ctx.user.userId }
        });

        if (!user?.id) {
            return No('用户不存在');
        }

        // 验证原密码
        const isValid = await befly.cipher.verifyPassword(ctx.body.oldPassword, user.password);
        if (!isValid) {
            return No('原密码错误');
        }

        // 加密新密码
        const hashedPassword = await befly.cipher.hashPassword(ctx.body.newPassword);

        // 更新密码
        await befly.db.updData({
            table: 'user',
            data: { password: hashedPassword },
            where: { id: ctx.user.userId }
        });

        return Yes('密码修改成功');
    }
} as ApiRoute;
```

### 用户列表（管理员）

`apis/user/list.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '用户列表',
    method: 'POST',
    auth: true,
    permission: 'user:list',
    fields: {
        page: '@page',
        limit: '@limit',
        keyword: '@keyword',
        state: '@state',
        role: { name: '角色', type: 'string', max: 20 }
    },
    handler: async (befly, ctx) => {
        const { page, limit, keyword, state, role } = ctx.body;

        // 构建查询条件
        const where: Record<string, any> = {};

        if (keyword) {
            where.$or = [{ email: { $like: `%${keyword}%` } }, { nickname: { $like: `%${keyword}%` } }, { phone: { $like: `%${keyword}%` } }];
        }

        if (state !== undefined) {
            where.state = state;
        }

        if (role) {
            where.role = role;
        }

        const result = await befly.db.getList({
            table: 'user',
            columns: ['id', 'email', 'nickname', 'avatar', 'phone', 'role', 'state', 'loginCount', 'lastLoginAt', 'createdAt'],
            where: where,
            page: page || 1,
            limit: limit || 20,
            orderBy: { id: 'desc' }
        });

        return Yes('获取成功', result);
    }
} as ApiRoute;
```

---

## 文章管理模块

一个完整的文章管理模块，包含发布、编辑、删除、列表、详情。

### 表定义

`tables/article.json`：

```json
{
    "title": "标题|string|2|200||true",
    "content": "内容|text|0|100000||true",
    "summary": "摘要|string|0|500",
    "cover": "封面|string|0|500",
    "category_id": "分类ID|number|0||",
    "tags": "标签|array_string|0|10|[]",
    "author_id": "作者ID|number|1||true",
    "view_count": "浏览量|number|0||0",
    "like_count": "点赞量|number|0||0",
    "comment_count": "评论量|number|0||0",
    "is_top": "是否置顶|number|0|1|0",
    "is_recommend": "是否推荐|number|0|1|0",
    "published_at": "发布时间|number|0||"
}
```

`tables/category.json`：

```json
{
    "name": "分类名|string|2|50||true",
    "slug": "别名|string|2|50||true",
    "description": "描述|string|0|200",
    "parent_id": "父分类|number|0||0",
    "sort": "排序|number|0|9999|0",
    "article_count": "文章数|number|0||0"
}
```

### 发布文章

`apis/article/create.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '发布文章',
    method: 'POST',
    auth: true,
    fields: {
        title: { name: '标题', type: 'string', min: 2, max: 200 },
        content: { name: '内容', type: 'text', min: 1, max: 100000 },
        summary: { name: '摘要', type: 'string', max: 500 },
        cover: { name: '封面', type: 'string', max: 500 },
        categoryId: { name: '分类', type: 'number', min: 0 },
        tags: { name: '标签', type: 'array_string', max: 10 }
    },
    required: ['title', 'content'],
    handler: async (befly, ctx) => {
        const { title, content, summary, cover, categoryId, tags } = ctx.body;

        // 自动生成摘要
        const autoSummary = summary || content.replace(/<[^>]+>/g, '').slice(0, 200);

        const result = await befly.db.insData({
            table: 'article',
            data: {
                title: title,
                content: content,
                summary: autoSummary,
                cover: cover || '',
                categoryId: categoryId || 0,
                tags: tags || [],
                authorId: ctx.user.userId,
                publishedAt: Date.now()
            }
        });

        // 更新分类文章数
        if (categoryId) {
            await befly.db.updData({
                table: 'category',
                data: { articleCount: { $incr: 1 } },
                where: { id: categoryId }
            });
        }

        return Yes('发布成功', { id: result.insertId });
    }
} as ApiRoute;
```

### 编辑文章

`apis/article/update.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '编辑文章',
    method: 'POST',
    auth: true,
    fields: {
        id: '@id',
        title: { name: '标题', type: 'string', min: 2, max: 200 },
        content: { name: '内容', type: 'text', min: 1, max: 100000 },
        summary: { name: '摘要', type: 'string', max: 500 },
        cover: { name: '封面', type: 'string', max: 500 },
        categoryId: { name: '分类', type: 'number', min: 0 },
        tags: { name: '标签', type: 'array_string', max: 10 }
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        const { id, title, content, summary, cover, categoryId, tags } = ctx.body;

        // 检查文章是否存在
        const article = await befly.db.getDetail({
            table: 'article',
            columns: ['id', 'authorId', 'categoryId'],
            where: { id: id }
        });

        if (!article?.id) {
            return No('文章不存在');
        }

        // 检查权限（只能编辑自己的文章，管理员除外）
        if (article.authorId !== ctx.user.userId && ctx.user.role !== 'admin') {
            return No('没有权限编辑此文章');
        }

        const updateData: Record<string, any> = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (summary !== undefined) updateData.summary = summary;
        if (cover !== undefined) updateData.cover = cover;
        if (categoryId !== undefined) updateData.categoryId = categoryId;
        if (tags !== undefined) updateData.tags = tags;

        if (Object.keys(updateData).length === 0) {
            return No('没有需要更新的字段');
        }

        await befly.db.updData({
            table: 'article',
            data: updateData,
            where: { id: id }
        });

        // 更新分类文章数（如果分类变更）
        if (categoryId !== undefined && categoryId !== article.categoryId) {
            if (article.categoryId) {
                await befly.db.updData({
                    table: 'category',
                    data: { articleCount: { $decr: 1 } },
                    where: { id: article.categoryId }
                });
            }
            if (categoryId) {
                await befly.db.updData({
                    table: 'category',
                    data: { articleCount: { $incr: 1 } },
                    where: { id: categoryId }
                });
            }
        }

        return Yes('更新成功');
    }
} as ApiRoute;
```

### 删除文章

`apis/article/delete.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '删除文章',
    method: 'POST',
    auth: true,
    fields: {
        id: '@id'
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        const article = await befly.db.getDetail({
            table: 'article',
            columns: ['id', 'authorId', 'categoryId'],
            where: { id: ctx.body.id }
        });

        if (!article?.id) {
            return No('文章不存在');
        }

        // 检查权限
        if (article.authorId !== ctx.user.userId && ctx.user.role !== 'admin') {
            return No('没有权限删除此文章');
        }

        // 软删除
        await befly.db.delData({
            table: 'article',
            where: { id: ctx.body.id }
        });

        // 更新分类文章数
        if (article.categoryId) {
            await befly.db.updData({
                table: 'category',
                data: { articleCount: { $decr: 1 } },
                where: { id: article.categoryId }
            });
        }

        return Yes('删除成功');
    }
} as ApiRoute;
```

### 文章列表

`apis/article/list.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '文章列表',
    method: 'POST',
    auth: false,
    fields: {
        page: '@page',
        limit: '@limit',
        keyword: '@keyword',
        categoryId: { name: '分类', type: 'number', min: 0 },
        authorId: { name: '作者', type: 'number', min: 0 },
        isTop: { name: '置顶', type: 'number', min: 0, max: 1 },
        isRecommend: { name: '推荐', type: 'number', min: 0, max: 1 },
        orderBy: { name: '排序', type: 'string', max: 20 }
    },
    handler: async (befly, ctx) => {
        const { page, limit, categoryId, authorId, keyword, isTop, isRecommend, orderBy } = ctx.body;

        const where: Record<string, any> = { state: 1 };

        if (categoryId) where.categoryId = categoryId;
        if (authorId) where.authorId = authorId;
        if (isTop !== undefined) where.isTop = isTop;
        if (isRecommend !== undefined) where.isRecommend = isRecommend;

        if (keyword) {
            where.$or = [{ title: { $like: `%${keyword}%` } }, { summary: { $like: `%${keyword}%` } }];
        }

        // 排序
        let order: Record<string, 'asc' | 'desc'> = { isTop: 'desc', publishedAt: 'desc' };
        if (orderBy === 'views') order = { viewCount: 'desc' };
        if (orderBy === 'likes') order = { likeCount: 'desc' };

        const result = await befly.db.getList({
            table: 'article',
            columns: ['id', 'title', 'summary', 'cover', 'categoryId', 'tags', 'authorId', 'viewCount', 'likeCount', 'commentCount', 'isTop', 'isRecommend', 'publishedAt'],
            where: where,
            page: page || 1,
            limit: limit || 10,
            orderBy: order
        });

        return Yes('获取成功', result);
    }
} as ApiRoute;
```

### 文章详情

`apis/article/detail.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '文章详情',
    method: 'GET',
    auth: false,
    fields: {
        id: '@id'
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        const article = await befly.db.getDetail({
            table: 'article',
            where: { id: ctx.body.id, state: 1 }
        });

        if (!article?.id) {
            return No('文章不存在');
        }

        // 增加浏览量
        await befly.db.updData({
            table: 'article',
            data: { viewCount: { $incr: 1 } },
            where: { id: ctx.body.id }
        });

        // 获取作者信息
        const author = await befly.db.getDetail({
            table: 'user',
            columns: ['id', 'nickname', 'avatar'],
            where: { id: article.authorId }
        });

        // 获取分类信息
        let category = null;
        if (article.categoryId) {
            category = await befly.db.getDetail({
                table: 'category',
                columns: ['id', 'name', 'slug'],
                where: { id: article.categoryId }
            });
        }

        return Yes('获取成功', {
            ...article,
            viewCount: article.viewCount + 1,
            author: author,
            category: category
        });
    }
} as ApiRoute;
```

---

## 文件上传

### 单文件上传

`apis/common/upload.ts`：

```typescript
import { join } from 'pathe';
import { existsSync, mkdirSync } from 'node:fs';
import type { ApiRoute } from 'befly/types';

export default {
    name: '文件上传',
    method: 'POST',
    auth: true,
    handler: async (befly, ctx) => {
        const formData = await ctx.req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return No('请选择文件');
        }

        // 检查文件大小（10MB）
        if (file.size > 10 * 1024 * 1024) {
            return No('文件大小不能超过 10MB');
        }

        // 检查文件类型
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return No('只支持 jpg/png/gif/webp 格式');
        }

        // 生成文件名
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${befly.cipher.randomString(8)}.${ext}`;

        // 保存目录
        const uploadDir = join(process.cwd(), 'uploads', new Date().toISOString().slice(0, 7));
        if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
        }

        // 保存文件
        const filePath = join(uploadDir, fileName);
        const buffer = await file.arrayBuffer();
        await Bun.write(filePath, buffer);

        // 返回 URL
        const url = `/uploads/${new Date().toISOString().slice(0, 7)}/${fileName}`;

        return Yes('上传成功', {
            url: url,
            name: file.name,
            size: file.size,
            type: file.type
        });
    }
} as ApiRoute;
```

---

## 数据导出

### 导出为 CSV

`apis/user/export.ts`：

```typescript
import type { ApiRoute } from 'befly/types';

export default {
    name: '导出用户',
    method: 'GET',
    auth: true,
    permission: 'user:export',
    handler: async (befly, ctx) => {
        // 获取所有用户
        const result = await befly.db.getList({
            table: 'user',
            columns: ['id', 'email', 'nickname', 'phone', 'role', 'state', 'createdAt'],
            where: { state: { $gte: 0 } },
            page: 1,
            limit: 10000
        });

        // 生成 CSV
        const headers = ['ID', '邮箱', '昵称', '手机号', '角色', '状态', '注册时间'];
        const rows = result.list.map((user: any) => [user.id, user.email, user.nickname, user.phone || '', user.role, user.state === 1 ? '正常' : '禁用', new Date(user.createdAt).toLocaleString()]);

        const csv = [headers.join(','), ...rows.map((row: any[]) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

        // 返回文件
        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="users_${Date.now()}.csv"`
            }
        });
    }
} as ApiRoute;
```

---

## 代码优化技巧

### 利用自动过滤简化更新操作

数据库操作会**自动过滤 null 和 undefined 值**，因此可以大幅简化代码。

#### 传统写法（繁琐）

```typescript
// ❌ 手动检查每个字段
const updateData: Record<string, any> = {};
if (ctx.body.nickname !== undefined) updateData.nickname = ctx.body.nickname;
if (ctx.body.avatar !== undefined) updateData.avatar = ctx.body.avatar;
if (ctx.body.phone !== undefined) updateData.phone = ctx.body.phone;
if (ctx.body.gender !== undefined) updateData.gender = ctx.body.gender;

if (Object.keys(updateData).length === 0) {
    return No('没有需要更新的字段');
}

await befly.db.updData({
    table: 'user',
    data: updateData,
    where: { id: ctx.user.userId }
});
```

#### 优化写法（简洁）

```typescript
// ✅ 直接传入，undefined 值自动过滤
const { nickname, avatar, phone, gender, birthday, bio } = ctx.body;

const data = { nickname: nickname, avatar: avatar, phone: phone, gender: gender, birthday: birthday, bio: bio };

// 使用 cleanFields 检查是否有有效数据
const cleanData = befly.tool.cleanFields(data);
if (Object.keys(cleanData).length === 0) {
    return No('没有需要更新的字段');
}

await befly.db.updData({
    table: 'user',
    data: cleanData,
    where: { id: ctx.user.userId }
});
```

### 使用 cleanFields 进行精细控制

当需要保留特定值（如 0、空字符串）时，使用 `cleanFields` 的高级参数：

```typescript
const { nickname, sort, state, remark } = ctx.body;

// 保留 0 值（sort 和 state 允许为 0）
const data = befly.tool.cleanFields(
    { nickname: nickname, sort: sort, state: state, remark: remark },
    [null, undefined], // 排除 null 和 undefined
    { sort: true, state: true } // 保留这些字段的 0 值
);

await befly.db.updData({
    table: 'menu',
    data: data,
    where: { id: ctx.body.id }
});
```

### 查询条件的自动过滤

where 条件同样支持自动过滤：

```typescript
// ✅ 可选筛选条件，undefined 自动忽略
const { keyword, state, categoryId, startDate, endDate } = ctx.body;

const result = await befly.db.getList({
    table: 'article',
    columns: ['id', 'title', 'createdAt'],
    where: {
        state: state, // undefined 时忽略
        categoryId: categoryId, // undefined 时忽略
        title: keyword ? { $like: `%${keyword}%` } : undefined, // 无关键词时忽略
        createdAt: startDate && endDate ? { $gte: startDate, $lte: endDate } : undefined
    },
    page: ctx.body.page || 1,
    limit: ctx.body.limit || 20
});
```

---

## 完整目录结构

```
apis/
├── user/
│   ├── register.ts      # 注册
│   ├── login.ts         # 登录
│   ├── info.ts          # 获取信息
│   ├── update.ts        # 更新信息
│   ├── changePassword.ts # 修改密码
│   ├── list.ts          # 用户列表
│   └── export.ts        # 导出用户
├── article/
│   ├── create.ts        # 发布文章
│   ├── update.ts        # 编辑文章
│   ├── delete.ts        # 删除文章
│   ├── list.ts          # 文章列表
│   └── detail.ts        # 文章详情
└── common/
    └── upload.ts        # 文件上传

tables/
├── user.json            # 用户表
├── article.json         # 文章表
└── category.json        # 分类表
```
