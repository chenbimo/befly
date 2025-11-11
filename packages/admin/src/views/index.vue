<template>
    <div class="page-home">
        <h1>首页</h1>
        <p>这是使用 default 布局的首页</p>
    </div>
</template>

<route lang="yaml">
meta:
    layout: default
    title: 首页
</route>

<style lang="scss" scoped>
.page-home {
    padding: 20px;

    h1 {
        color: $primary-color;
        margin-bottom: 16px;
    }

    p {
        color: $text-color-secondary;
    }
}
</style>
