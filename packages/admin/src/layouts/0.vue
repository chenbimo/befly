<template>
    <t-layout class="layout-container">
        <!-- 侧边栏 -->
        <t-aside width="240px">
            <div class="logo">
                <h2>Befly Admin</h2>
            </div>
            <t-menu :value="activeMenu" @change="handleMenuChange">
                <t-menu-item value="dashboard">
                    <template #icon>
                        <dashboard-icon />
                    </template>
                    仪表盘
                </t-menu-item>
            </t-menu>
        </t-aside>

        <!-- 主内容区 -->
        <t-layout>
            <!-- 顶部导航栏 -->
            <t-header class="header">
                <div class="header-left">
                    <h3>{{ currentTitle }}</h3>
                </div>
                <div class="header-right">
                    <t-dropdown :options="userMenuOptions" @click="handleUserMenu">
                        <t-button variant="text">
                            <user-icon />
                            <span class="ml-2">管理员</span>
                        </t-button>
                    </t-dropdown>
                </div>
            </t-header>

            <!-- 内容区域 -->
            <t-content class="content">
                <RouterView />
            </t-content>
        </t-layout>
    </t-layout>
</template>

<script setup lang="ts">
// 引入 SCSS mixins（如果需要在 script 中使用）
// import '@/styles/mixins.scss';

import { DashboardIcon, UserIcon } from 'tdesign-icons-vue-next';

const router = useRouter();
const route = useRoute();

const activeMenu = computed(() => route.name as string);
const currentTitle = computed(() => route.meta.title || '');

const userMenuOptions = [
    { content: '个人中心', value: 'profile' },
    { content: '退出登录', value: 'logout' }
];

const handleMenuChange = (value: string) => {
    router.push({ name: value });
};

const handleUserMenu = (data: any) => {
    if (data.value === 'logout') {
        localStorage.removeItem('token');
        router.push('/login');
        MessagePlugin.success('退出成功');
    }
};
</script>

<style scoped lang="scss">
.layout-container {
    height: 100vh;
}

.logo {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--td-border-level-1-color);
}

.logo h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: var(--td-bg-color-container);
    border-bottom: 1px solid var(--td-border-level-1-color);
}

.header-left h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 16px;
}

.ml-2 {
    margin-left: 8px;
}

.content {
    padding: 24px;
    background: var(--td-bg-color-page);
    overflow-y: auto;
}
</style>
