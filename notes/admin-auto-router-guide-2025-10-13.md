# Befly Admin - 自动文件路由使用指南

## 📝 概述

基于 views 目录结构自动生成路由配置，无需手动维护路由文件。

## 🎯 路由规则

### 基础规则

1. **views/ 下的每个 .vue 文件自动生成路由**
2. **index.vue 映射为父目录路径**
3. **文件名自动转换为 kebab-case**
4. **支持嵌套路由**
5. **自动识别公开路由**

### 文件映射示例

```
views/
├── login/
│   └── index.vue       → /login (公开)
├── dashboard/
│   └── index.vue       → /dashboard (需要登录)
├── user/
│   ├── list.vue        → /user/list
│   ├── detail.vue      → /user/detail
│   └── create.vue      → /user/create
├── setting/
│   ├── index.vue       → /setting
│   ├── profile.vue     → /setting/profile
│   └── security.vue    → /setting/security
└── system/
    ├── role.vue        → /system/role
    └── menu.vue        → /system/menu
```

## 🔐 公开路由

以下路由自动识别为公开路由（不需要登录）：

-   `/login` - 登录页
-   `/register` - 注册页
-   `/forgot-password` - 忘记密码
-   `/404` - 404 页面
-   `/403` - 403 页面
-   `/500` - 500 页面

其他路由默认需要登录验证。

## 📋 命名规则

### 路由路径命名

文件名会自动转换为 kebab-case：

```
UserList.vue    → /user-list
userProfile.vue → /user-profile
MySettings.vue  → /my-settings
```

### 路由名称命名

文件路径会转换为 PascalCase：

```
views/user/list.vue     → 路由名: UserList
views/setting/index.vue → 路由名: Setting
views/dashboard/index.vue → 路由名: Dashboard
```

## 🎨 使用示例

### 1. 创建简单页面

创建文件：`views/about/index.vue`

```vue
<template>
    <div class="about-page">
        <h1>关于我们</h1>
        <p>这是关于页面</p>
    </div>
</template>

<script setup lang="ts">
// 自动路由：/about
// 路由名称：About
// 需要登录：是
</script>
```

访问：`http://localhost:5173/about`

### 2. 创建列表页面

创建文件：`views/product/list.vue`

```vue
<template>
    <div class="product-list">
        <h1>产品列表</h1>
        <t-table :data="products" />
    </div>
</template>

<script setup lang="ts">
// 自动路由：/product/list
// 路由名称：ProductList
// 需要登录：是

const products = ref([]);
</script>
```

访问：`http://localhost:5173/product/list`

### 3. 创建详情页面

创建文件：`views/product/detail.vue`

```vue
<template>
    <div class="product-detail">
        <h1>产品详情</h1>
        <p>ID: {{ route.query.id }}</p>
    </div>
</template>

<script setup lang="ts">
// 自动路由：/product/detail
// 路由名称：ProductDetail
// 需要登录：是

const route = useRoute();
</script>
```

访问：`http://localhost:5173/product/detail?id=123`

### 4. 创建公开页面

创建文件：`views/register/index.vue`

```vue
<template>
    <div class="register-page">
        <h1>用户注册</h1>
        <t-form>
            <!-- 注册表单 -->
        </t-form>
    </div>
</template>

<script setup lang="ts">
// 自动路由：/register
// 路由名称：Register
// 需要登录：否（自动识别为公开路由）
</script>
```

访问：`http://localhost:5173/register` （无需登录）

## 🔧 路由导航

### 使用路由名称导航

```vue
<template>
    <!-- 使用路由名称 -->
    <t-button @click="router.push({ name: 'UserList' })"> 用户列表 </t-button>

    <!-- 使用路径 -->
    <t-button @click="router.push('/user/list')"> 用户列表 </t-button>

    <!-- 带参数 -->
    <t-button
        @click="
            router.push({
                name: 'UserDetail',
                query: { id: 123 }
            })
        "
    >
        查看详情
    </t-button>
</template>

<script setup lang="ts">
const router = useRouter();
</script>
```

### RouterLink 组件

```vue
<template>
    <!-- 使用路由名称 -->
    <router-link :to="{ name: 'Dashboard' }"> 仪表盘 </router-link>

    <!-- 使用路径 -->
    <router-link to="/user/list"> 用户列表 </router-link>
</template>
```

## 📁 目录结构建议

```
views/
├── login/              # 登录相关
│   └── index.vue
├── dashboard/          # 仪表盘
│   └── index.vue
├── user/               # 用户管理
│   ├── list.vue        # 用户列表
│   ├── detail.vue      # 用户详情
│   └── create.vue      # 创建用户
├── role/               # 角色管理
│   ├── list.vue
│   └── create.vue
├── setting/            # 系统设置
│   ├── index.vue       # 设置首页
│   ├── profile.vue     # 个人资料
│   └── security.vue    # 安全设置
└── components/         # 页面组件（不会生成路由）
    ├── UserForm.vue
    └── RoleSelector.vue
```

## 🚫 排除目录

以下目录不会生成路由：

-   `components/` - 页面组件目录
-   其他通过插件配置排除的目录

## ⚙️ 插件配置

在 `vite.config.ts` 中配置：

```typescript
import { autoRouterPlugin } from './src/plugins/router';

export default defineConfig({
    plugins: [
        autoRouterPlugin({
            viewsDir: '@/views', // views 目录路径
            layoutsDir: '@/layouts', // 布局目录路径
            exclude: ['components'] // 排除的目录
        })
    ]
});
```

## 🎭 布局系统

### 默认布局

所有需要登录的页面自动使用 `layouts/default.vue` 布局。

### 公开页面无布局

公开页面（如登录页）不使用布局，直接渲染。

## 🔍 调试路由

### 查看所有路由

```vue
<script setup lang="ts">
const router = useRouter();

// 打印所有路由
console.log(router.getRoutes());

// 查看当前路由
console.log(router.currentRoute.value);
</script>
```

### 监听路由变化

```vue
<script setup lang="ts">
const route = useRoute();

watch(
    () => route.path,
    (newPath) => {
        console.log('路由变化:', newPath);
    }
);
</script>
```

## 💡 最佳实践

### 1. 文件命名规范

```
✅ 推荐
views/user/list.vue
views/user/detail.vue
views/setting/profile.vue

❌ 不推荐
views/user/UserList.vue
views/user/user-detail.vue
views/setting/Profile.vue
```

### 2. 目录结构清晰

```
✅ 推荐 - 按功能模块分组
views/
├── user/
├── role/
├── product/
└── order/

❌ 不推荐 - 文件平铺
views/
├── user-list.vue
├── user-detail.vue
├── role-list.vue
└── role-detail.vue
```

### 3. 使用路由元信息

```vue
<script setup lang="ts">
const route = useRoute();

// 获取路由元信息
const title = route.meta.title;
const isPublic = route.meta.public;
</script>
```

## 🆚 对比手动路由

### 手动路由（旧方式）

```typescript
// router/index.ts
const routes = [
    {
        path: '/user/list',
        name: 'UserList',
        component: () => import('@/views/user/list.vue')
    },
    {
        path: '/user/detail',
        name: 'UserDetail',
        component: () => import('@/views/user/detail.vue')
    }
    // ... 需要手动添加每个路由
];
```

### 自动路由（新方式）

```typescript
// 只需创建文件
views/user/list.vue    ✅ 自动生成路由
views/user/detail.vue  ✅ 自动生成路由
```

## ⚠️ 注意事项

1. **文件名唯一性**: 确保同名文件不在不同目录
2. **路由冲突**: 避免路径冲突
3. **重启开发服务器**: 添加新文件后需要刷新页面
4. **TypeScript 支持**: 已配置类型定义，有完整的类型提示

## 🎉 优势

-   ✅ **零配置**: 创建文件即可，无需手动配置路由
-   ✅ **类型安全**: 完整的 TypeScript 支持
-   ✅ **自动布局**: 自动应用布局系统
-   ✅ **权限控制**: 自动识别公开/私有路由
-   ✅ **开发效率**: 大幅提升开发速度

---

**更新日期**: 2025-10-13
**版本**: v1.0.0
**状态**: ✅ 已实现
