# Befly Admin - SCSS 使用指南

## 📝 SCSS 配置说明

已完成的配置：

-   ✅ 移除 JSX 支持
-   ✅ 添加 SCSS 支持
-   ✅ 全局变量自动注入
-   ✅ 提供常用 Mixins

## 🎨 全局变量

在任何 `.vue` 或 `.scss` 文件中都可以直接使用全局变量，无需导入。

### 使用方式

```vue
<style scoped lang="scss">
.my-component {
    // 直接使用全局变量
    color: $primary-color;
    background: $bg-color-container;
    padding: $spacing-md;
    border-radius: $border-radius;
    box-shadow: $shadow-medium;
}
</style>
```

### 可用变量

#### 主题色

```scss
$primary-color: #0052d9;
$success-color: #00a870;
$warning-color: #ed7b2f;
$error-color: #e34d59;
$info-color: #0052d9;
```

#### 文本颜色

```scss
$text-primary: rgba(0, 0, 0, 0.9);
$text-secondary: rgba(0, 0, 0, 0.6);
$text-placeholder: rgba(0, 0, 0, 0.4);
$text-disabled: rgba(0, 0, 0, 0.26);
```

#### 间距

```scss
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;
```

#### 阴影

```scss
$shadow-small: 0 2px 4px rgba(0, 0, 0, 0.05);
$shadow-medium: 0 4px 8px rgba(0, 0, 0, 0.1);
$shadow-large: 0 8px 16px rgba(0, 0, 0, 0.15);
```

#### 响应式断点

```scss
$breakpoint-xs: 480px;
$breakpoint-sm: 768px;
$breakpoint-md: 992px;
$breakpoint-lg: 1200px;
$breakpoint-xl: 1600px;
```

## 🔧 Mixins 使用

需要手动导入 Mixins：

```vue
<style scoped lang="scss">
@use '@/styles/mixins.scss' as *;

.my-component {
    // 使用文本省略
    @include text-ellipsis(2);

    // 使用 flex 居中
    @include flex-center;

    // 使用阴影
    @include shadow(medium);

    // 使用过渡动画
    @include transition(all, 0.3s);
}
</style>
```

### 可用 Mixins

#### 文本省略

```scss
// 单行省略
@include text-ellipsis(1);

// 多行省略
@include text-ellipsis(3);
```

#### Flex 布局

```scss
// 居中
@include flex-center;

// 两端对齐
@include flex-between;
```

#### 响应式断点

```scss
.my-component {
    width: 100%;

    // 小屏幕
    @include respond-to(xs) {
        width: 90%;
    }

    // 大屏幕
    @include respond-to(xl) {
        width: 1200px;
    }
}
```

#### 阴影效果

```scss
// 小阴影
@include shadow(small);

// 中等阴影
@include shadow(medium);

// 大阴影
@include shadow(large);
```

#### 动画过渡

```scss
// 默认过渡
@include transition();

// 自定义过渡
@include transition(transform, 0.5s, ease-in-out);
```

#### 绝对居中

```scss
.modal {
    @include absolute-center;
}
```

## 📋 完整示例

### 示例 1：卡片组件

```vue
<template>
    <div class="custom-card">
        <div class="card-header">
            <h3 class="card-title">标题</h3>
        </div>
        <div class="card-body">
            <p class="card-text">这是卡片内容</p>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins.scss' as *;

.custom-card {
    background: $bg-color-container;
    border-radius: $border-radius;
    padding: $spacing-lg;
    @include shadow(medium);
    @include transition();

    &:hover {
        @include shadow(large);
        transform: translateY(-2px);
    }
}

.card-header {
    @include flex-between;
    margin-bottom: $spacing-md;
    padding-bottom: $spacing-sm;
    border-bottom: 1px solid $border-color;
}

.card-title {
    color: $text-primary;
    font-size: $font-size-lg;
    margin: 0;
}

.card-text {
    color: $text-secondary;
    font-size: $font-size-md;
    @include text-ellipsis(3);
}
</style>
```

### 示例 2：响应式布局

```vue
<template>
    <div class="responsive-container">
        <div class="content">响应式内容</div>
    </div>
</template>

<style scoped lang="scss">
@use '@/styles/mixins.scss' as *;

.responsive-container {
    padding: $spacing-lg;

    // 移动端
    @include respond-to(xs) {
        padding: $spacing-sm;
    }

    // 平板
    @include respond-to(sm) {
        padding: $spacing-md;
    }

    // 桌面端
    @include respond-to(xl) {
        max-width: 1200px;
        margin: 0 auto;
    }
}

.content {
    background: $primary-color;
    color: white;
    padding: $spacing-md;
    border-radius: $border-radius;
    @include flex-center;
    @include transition();
}
</style>
```

### 示例 3：按钮样式

```vue
<template>
    <button class="custom-button">点击我</button>
</template>

<style scoped lang="scss">
@use '@/styles/mixins.scss' as *;

.custom-button {
    padding: $spacing-sm $spacing-lg;
    background: $primary-color;
    color: white;
    border: none;
    border-radius: $border-radius;
    font-size: $font-size-md;
    cursor: pointer;
    @include transition();
    @include shadow(small);

    &:hover {
        background: darken($primary-color, 10%);
        @include shadow(medium);
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0);
        @include shadow(small);
    }

    &:disabled {
        background: $text-disabled;
        cursor: not-allowed;
        box-shadow: none;
    }
}
</style>
```

## 🎯 最佳实践

### 1. 使用 scoped 样式

```vue
<style scoped lang="scss">
// 组件内部样式，不会影响全局
</style>
```

### 2. 变量命名规范

```scss
// ✅ 好的命名
$primary-color
$spacing-md
$border-radius

// ❌ 避免的命名
$color1
$s
$br
```

### 3. 利用嵌套

```scss
.card {
    padding: $spacing-md;

    &-header {
        font-size: $font-size-lg;
    }

    &-body {
        color: $text-secondary;
    }

    &:hover {
        @include shadow(medium);
    }
}
```

### 4. 使用 BEM 命名

```scss
.block {
    &__element {
        // 元素样式
    }

    &--modifier {
        // 修饰符样式
    }
}
```

## 📚 文件结构

```
src/styles/
├── index.css           # 全局基础样式（CSS）
├── variables.scss      # 全局变量（自动注入）
└── mixins.scss         # 混合宏（需要手动导入）
```

## 🔄 更新记录

-   ✅ 移除 `@vitejs/plugin-vue-jsx` 插件
-   ✅ 移除 TypeScript 的 JSX 配置
-   ✅ 添加 `sass` 依赖
-   ✅ 配置 SCSS 预处理器
-   ✅ 创建全局变量文件
-   ✅ 创建 Mixins 文件
-   ✅ 自动注入全局变量
-   ✅ 所有 Vue 组件样式改用 `lang="scss"`

---

**更新日期**: 2025-10-13
**状态**: ✅ 完成
