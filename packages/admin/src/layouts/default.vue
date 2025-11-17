<template>
    <div class="layout-0-wrapper">
        <!-- 顶部导航栏 -->
        <div class="layout-header">
            <div class="logo">
                <h2>{{ $Config.appTitle }}</h2>
            </div>
            <div class="header-right">
                <div class="user-info-bar">
                    <div class="user-text">
                        <span class="user-name">{{ $Data.userInfo.nickname || '管理员' }}</span>
                        <t-tag theme="primary" size="small" variant="light">{{ $Data.userInfo.role || '超级管理员' }}</t-tag>
                    </div>
                    <t-button variant="text" size="medium" @click="$Method.handleLogout">
                        <template #icon>
                            <i-lucide:x />
                        </template>
                    </t-button>
                </div>
            </div>
        </div>

        <!-- 菜单栏 -->
        <div class="layout-menu">
            <t-menu v-model:value="$Data.currentMenuKey" v-model:expanded="$Data.expandedKeys" style="height: 100%" @change="$Method.onMenuClick">
                <template v-for="menu in $Data.userMenus" :key="menu.id">
                    <!-- 无子菜单 -->
                    <t-menu-item v-if="!menu.children || menu.children.length === 0" :value="menu.path">
                        <template #icon>
                            <i-lucide:home v-if="menu.path === '/addon/admin/'" style="margin-right: 8px" />
                            <i-lucide:file-text v-else style="margin-right: 8px" />
                        </template>
                        {{ menu.name }}
                    </t-menu-item>
                    <!-- 有子菜单 -->
                    <t-submenu v-else :value="String(menu.id)" :title="menu.name">
                        <template #icon>
                            <i-lucide:folder style="margin-right: 8px" />
                        </template>
                        <t-menu-item v-for="child in menu.children" :key="child.id" :value="child.path">
                            <template #icon>
                                <i-lucide:file-text style="margin-right: 8px" />
                            </template>
                            {{ child.name }}
                        </t-menu-item>
                    </t-submenu>
                </template>
            </t-menu>
        </div>

        <!-- 内容区域 -->
        <div class="layout-content">
            <RouterView />
        </div>

        <!-- 底部分页栏 -->
        <div class="layout-footer">
            <span>© 2024 Befly. All rights reserved.</span>
        </div>
    </div>
</template>

<script setup>
import { arrayToTree } from 'befly-util/arrayToTree';

const router = useRouter();
const route = useRoute();
const global = useGlobal();

const $From = {
    treeMenuRef: null
};

// 响应式数据
const $Data = $ref({
    userMenus: [],
    userMenusFlat: [], // 一维菜单数据
    expandedKeys: [],
    currentMenuKey: '',
    userInfo: {
        nickname: '管理员',
        role: '超级管理员'
    }
});

// 方法
const $Method = {
    // 获取用户菜单权限
    async fetchUserMenus() {
        try {
            const { data } = await $Http('/addon/admin/menu/all');
            // 保存一维数据
            $Data.userMenusFlat = data;
            $Data.userMenus = arrayToTree(data);
            $Method.setActiveMenu();
        } catch (error) {
            console.error('获取用户菜单失败:', error);
        }
    },

    // 设置当前激活的菜单（从一维数据查找并构建父级链）
    setActiveMenu() {
        const currentPath = route.path;

        // 在一维数据中查找当前路径对应的菜单
        const currentMenu = $Data.userMenusFlat.find((menu) => menu.path === currentPath);

        if (!currentMenu) {
            return;
        }

        // 构建展开的父级链
        const expandedKeys = [];
        let menu = currentMenu;

        // 向上查找所有父级
        while (menu.pid) {
            const parent = $Data.userMenusFlat.find((m) => m.id === menu.pid);
            if (parent) {
                expandedKeys.unshift(String(parent.id));
                menu = parent;
            } else {
                break;
            }
        }

        // 设置展开的父级和当前激活的菜单
        $Data.expandedKeys = expandedKeys;
        $Data.currentMenuKey = currentPath;
    },

    // 处理菜单点击
    onMenuClick(path) {
        if (path) {
            router.push(path);
        }
    },

    // 处理退出登录
    handleLogout() {
        DialogPlugin.confirm({
            body: '确定要退出登录吗？',
            header: '确认',
            onConfirm: () => {
                $Storage.local.remove('token');
                router.push('/internal/login');
                MessagePlugin.success('退出成功');
            }
        });
    }
};

$Method.fetchUserMenus();
</script>

<style scoped lang="scss">
.layout-0-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    height: 100vh;
    width: 100vw;
    background: var(--bg-color-page);
    overflow: hidden;

    .layout-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: var(--header-height);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 var(--spacing-lg);
        background: var(--bg-color-container);
        border-bottom: 1px solid var(--border-color);
        z-index: 100;

        .logo {
            h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 700;
                color: var(--text-primary);
                letter-spacing: 0.5px;
                background: linear-gradient(135deg, var(--primary-color) 0%, #0084f4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);

            .user-info-bar {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);

                .user-text {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;

                    .user-name {
                        font-size: var(--font-size-sm);
                        font-weight: 500;
                        color: var(--text-primary);
                    }
                }
            }
        }
    }

    .layout-menu {
        position: absolute;
        top: var(--header-height);
        left: 0;
        bottom: var(--footer-height);
        width: var(--sidebar-width);
        background: var(--bg-color-container);
        border-right: 1px solid var(--border-color);
        z-index: 99;
        overflow-y: auto;
    }

    .layout-content {
        position: absolute;
        top: var(--header-height);
        left: var(--sidebar-width);
        right: 0;
        bottom: var(--footer-height);
        background: var(--bg-color-page);
        overflow-y: auto;
    }

    .layout-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: var(--footer-height);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-color-container);
        border-top: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
        z-index: 98;
    }
}
</style>
