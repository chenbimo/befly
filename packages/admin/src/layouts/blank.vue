<template>
    <div class="layout-blank">
        <router-view />
    </div>
</template>

<style lang="scss" scoped>
.layout-blank {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $bg-color;
}
</style>
