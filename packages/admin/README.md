# Befly Admin

基于 Vue3 + TDesign Vue Next + TypeScript + Vite 的后台管理系统。

## 技术栈

-   **Vue 3** - 渐进式 JavaScript 框架
-   **TDesign Vue Next** - 企业级设计体系
-   **TypeScript** - 类型安全
-   **Vite** - 下一代前端构建工具
-   **SCSS** - CSS 预处理器
-   **Vue Router** - 路由管理
-   **Pinia** - 状态管理
-   **unplugin-auto-import** - API 自动导入
-   **unplugin-vue-components** - 组件自动导入

## 特性

-   ✅ 自动导入 Vue3 API（ref、reactive、computed 等）
-   ✅ 自动导入 TDesign 组件（无需手动注册）
-   ✅ 自动导入 Vue Router 和 Pinia API
-   ✅ TypeScript 类型安全
-   ✅ SCSS 支持（全局变量 + Mixins）
-   ✅ 响应式布局
-   ✅ 路由权限控制
-   ✅ 代理配置（开发环境）

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 构建生产版本
bun run build

# 预览生产版本
bun run preview

# 类型检查
bun run type-check
```

## 项目结构

```
admin/
├── src/
│   ├── layouts/          # 布局组件
│   ├── views/            # 页面组件
│   │   ├── login/        # 登录页
│   │   └── dashboard/    # 仪表盘
│   ├── router/           # 路由配置
│   ├── styles/           # 全局样式
│   ├── types/            # 类型定义
│   ├── App.vue           # 根组件
│   └── main.ts           # 入口文件
├── index.html
├── vite.config.ts        # Vite 配置
├── tsconfig.json         # TypeScript 配置
└── package.json
```

## 自动导入说明

### API 自动导入

无需手动导入以下 API，直接使用即可：

```typescript
// ❌ 不需要这样写
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { defineStore } from 'pinia';

// ✅ 直接使用
const count = ref(0);
const router = useRouter();
const store = defineStore('main', {});
```

### 组件自动导入

TDesign 组件无需手动导入和注册：

```vue
<template>
    <!-- ✅ 直接使用，无需导入 -->
    <t-button>按钮</t-button>
    <t-input v-model="value" />
    <t-table :data="tableData" />
</template>

<script setup lang="ts">
// ❌ 不需要这样写
// import { Button, Input, Table } from 'tdesign-vue-next';
</script>
```

## 配置说明

### Vite 配置

-   **自动导入配置**: `unplugin-auto-import` 和 `unplugin-vue-components`
-   **路径别名**: `@` 指向 `src` 目录
-   **开发服务器**: 端口 5173，自动打开浏览器
-   **代理配置**: `/api` 代理到 `http://localhost:3000`

### TypeScript 配置

-   **严格模式**: 启用所有严格类型检查
-   **路径映射**: `@/*` 映射到 `src/*`
-   **自动生成类型**: `auto-imports.d.ts` 和 `components.d.ts`

## 构建

```bash
# 构建生产版本
bun run build

# 输出目录：dist/
```

构建优化：

-   代码分割（Vue、TDesign 单独打包）
-   Tree-shaking
-   压缩优化
-   Chunk size 限制：1500KB

## 注意事项

1. **自动导入的类型定义**：首次运行会生成 `src/types/auto-imports.d.ts` 和 `components.d.ts`
2. **登录功能**：当前为模拟登录，需要对接真实 API
3. **Token 存储**：使用 localStorage，生产环境建议使用更安全的方式
4. **API 代理**：开发环境 `/api` 代理到 `http://localhost:3000`

## License

Apache-2.0
