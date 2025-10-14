<template>
    <t-layout class="layout-container">
        <!-- 侧边栏 -->
        <t-aside :width="$Data.collapsed ? '64px' : '240px'" class="sidebar">
            <div class="logo">
                <h2 v-if="!$Data.collapsed">Befly Admin</h2>
                <h2 v-else class="logo-short">B</h2>
            </div>
            <t-menu :value="activeMenu" @change="handleMenuChange" :expanded="$Data.expandedKeys" :collapsed="$Data.collapsed" :expand-type="$Data.collapsed ? 'popup' : 'normal'" theme="light">
                <template v-for="item in $Data.menuItems" :key="item.value">
                    <!-- 一级菜单项 -->
                    <t-menu-item v-if="!item.children" :value="item.value">
                        <template #icon>
                            <component :is="item.icon" />
                        </template>
                        {{ item.label }}
                    </t-menu-item>
                    <!-- 带子菜单的项 -->
                    <t-submenu v-else :value="item.value" :title="item.label">
                        <template #icon>
                            <component :is="item.icon" />
                        </template>
                        <t-menu-item v-for="child in item.children" :key="child.value" :value="child.value">
                            {{ child.label }}
                        </t-menu-item>
                    </t-submenu>
                </template>
            </t-menu>
        </t-aside>

        <!-- 主内容区 -->
        <t-layout>
            <!-- 顶部导航栏 -->
            <t-header class="header">
                <div class="header-left">
                    <t-button variant="text" @click="$Method.toggleCollapse" class="collapse-btn">
                        <view-list-icon v-if="$Data.collapsed" />
                        <view-module-icon v-else />
                    </t-button>
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
import { DashboardIcon, UserIcon, FileIcon, SettingIcon, AppIcon, ViewListIcon, ViewModuleIcon } from 'tdesign-icons-vue-next';

const router = useRouter();
const route = useRoute();

// 响应式数据
const $Data = $ref({
    collapsed: localStorage.getItem('sidebar-collapsed') === 'true',
    expandedKeys: [] as string[],
    menuItems: [] as any[]
});

// 方法
const $Method = {
    // 切换折叠状态
    toggleCollapse() {
        $Data.collapsed = !$Data.collapsed;
        localStorage.setItem('sidebar-collapsed', String($Data.collapsed));
    }
};

// 当前激活菜单
const activeMenu = computed(() => route.name as string);
const currentTitle = computed(() => route.meta.title || '');

// 图标映射（根据路由名称首段匹配）
const iconMap: Record<string, any> = {
    index: DashboardIcon,
    user: UserIcon,
    news: FileIcon,
    system: SettingIcon,
    default: AppIcon
};

// 从路由构建菜单结构
function buildMenuFromRoutes() {
    const routes = router.getRoutes();
    // 过滤掉布局路由和登录页
    const pageRoutes = routes.filter((r) => r.name && r.name !== 'layout0' && r.name !== 'login' && !String(r.name).startsWith('layout'));
    const menuTree: Record<string, any> = {};
    for (const r of pageRoutes) {
        const name = String(r.name);
        const segments = name.split('-');
        const firstSeg = segments[0];
        // 一级菜单
        if (!menuTree[firstSeg]) {
            menuTree[firstSeg] = {
                value: segments.length === 1 ? name : firstSeg,
                label: firstSeg.charAt(0).toUpperCase() + firstSeg.slice(1),
                icon: iconMap[firstSeg] || iconMap.default,
                children: []
            };
        }
        // 多级路由加入子菜单
        if (segments.length > 1) {
            menuTree[firstSeg].children.push({
                value: name,
                label: segments.slice(1).join(' / ')
            });
        }
    }
    $Data.menuItems = Object.values(menuTree).sort((a, b) => {
        if (a.value === 'index') return -1;
        if (b.value === 'index') return 1;
        return a.label.localeCompare(b.label);
    });
    // 默认展开所有包含子菜单的项
    $Data.expandedKeys = $Data.menuItems.filter((m) => m.children && m.children.length).map((m) => m.value);
}

// 组件挂载时构建菜单
onMounted(() => {
    buildMenuFromRoutes();
});

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

.sidebar {
    transition: width 0.3s ease;
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

.logo-short {
    font-size: 24px;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: var(--td-bg-color-container);
    border-bottom: 1px solid var(--td-border-level-1-color);
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.header-left h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
}

.collapse-btn {
    font-size: 20px;
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
