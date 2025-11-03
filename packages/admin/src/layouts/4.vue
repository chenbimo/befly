<template>
    <div class="custom-layout-0">
        <h1>这是用户自定义的布局 0（覆盖 internal）</h1>
        <RouterView />
    </div>
</template>

<script setup>
// 测试用户自定义布局是否能覆盖 internal 布局
</script>

<style scoped>
.custom-layout-0 {
    background-color: #f0f0f0;
    padding: 20px;
}
</style>
