<template>
    <ConfigProvider :global-config="globalConfig">
        <div id="app">
            <RouterView />
        </div>
    </ConfigProvider>
</template>

<script setup>
import { ConfigProvider } from 'tdesign-vue-next';

const globalConfig = {
    dialog: {
        closeOnOverlayClick: false
    },
    table: {
        // 表格默认配置
        size: 'medium',
        bordered: false,
        stripe: false,
        showHeader: true,
        // 列默认配置（需要在每个列上单独设置）
        cellEmptyContent: '-'
    }
};
</script>

<style scoped>
#app {
    width: 100%;
    height: 100vh;
}
</style>
