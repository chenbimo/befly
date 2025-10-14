<template>
    <div class="layout-container">
        <RouterView />
    </div>
</template>

<script setup lang="ts">
import { DashboardIcon, UserIcon, FileIcon, SettingIcon, AppIcon, ViewListIcon, ViewModuleIcon } from 'tdesign-icons-vue-next';

const router = useRouter();
const route = useRoute();

// 响应式数据
const $Data = $ref({});

// 方法
const $Method = {};
</script>

<style scoped lang="scss">
.layout-container {
    height: 100vh;
}
</style>
