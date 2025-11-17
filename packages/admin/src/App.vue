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
    }
};
</script>

<style scoped>
#app {
    width: 100%;
    height: 100vh;
}
</style>
