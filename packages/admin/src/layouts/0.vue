<template>
    <t-layout class="layout-container">
        <!-- 顶部导航栏（全宽） -->
        <t-header class="header">
            <div class="header-left">
                <div class="logo">
                    <h2>Befly Admin</h2>
                </div>
            </div>
            <div class="header-right">
                <t-dropdown :options="userMenuOptions" @click="$Method.handleUserMenu">
                    <t-button variant="text">
                        <user-icon />
                        <span class="ml-2">管理员</span>
                    </t-button>
                </t-dropdown>
            </div>
        </t-header>

        <!-- 菜单栏（全宽，水平布局） -->
        <t-header class="menu-bar">
            <t-menu :value="activeMenu" @change="$Method.handleMenuChange" mode="horizontal" theme="light" style="width: 100%">
                <template v-for="item in $Data.menuItems" :key="item.value">
                    <!-- 一级菜单项（无子菜单） -->
                    <t-menu-item v-if="!item.children || item.children.length === 0" :value="item.value">
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
                            <template v-if="child.icon" #icon>
                                <component :is="child.icon" />
                            </template>
                            {{ child.label }}
                        </t-menu-item>
                    </t-submenu>
                </template>
            </t-menu>
            <!-- 调试信息 -->
            <div v-if="$Data.menuItems.length === 0" style="padding: 0 16px; color: #999; font-size: 14px">菜单加载中...（{{ $Data.menuItems.length }} 项）</div>
        </t-header>

        <!-- 内容区域 -->
        <t-content class="content">
            <RouterView />
        </t-content>
    </t-layout>
</template>

<script setup lang="ts">
import { usePermissionStore } from '@/stores/permission';

const router = useRouter();
const route = useRoute();
const permissionStore = usePermissionStore();

// 响应式数据
const $Data = $ref({
    menuItems: [] as any[]
});

// 当前激活菜单 - 使用路由路径作为菜单值
const activeMenu = computed(() => {
    return route.path;
});

// 图标映射 - 支持小写和Icon后缀两种格式
const iconMap: Record<string, any> = {
    // 小写格式
    dashboard: markRaw(DashboardIcon),
    home: markRaw(HomeIcon),
    user: markRaw(UserIcon),
    admin: markRaw(UserIcon),
    news: markRaw(FileIcon),
    article: markRaw(FileIcon),
    file: markRaw(FileIcon),
    system: markRaw(SettingIcon),
    setting: markRaw(SettingIcon),
    menu: markRaw(ViewListIcon),
    viewlist: markRaw(ViewListIcon),
    role: markRaw(AppIcon),
    app: markRaw(AppIcon),
    // Icon后缀格式（与后端配置一致）
    DashboardIcon: markRaw(DashboardIcon),
    HomeIcon: markRaw(HomeIcon),
    UserIcon: markRaw(UserIcon),
    FileIcon: markRaw(FileIcon),
    SettingIcon: markRaw(SettingIcon),
    ViewListIcon: markRaw(ViewListIcon),
    AppIcon: markRaw(AppIcon),
    // 默认图标
    default: markRaw(AppIcon)
};

// 用户菜单选项
const userMenuOptions = [
    { content: '个人中心', value: 'profile' },
    { content: '退出登录', value: 'logout' }
];

// 方法
const $Method = {
    // 从权限 store 构建菜单结构
    buildMenuFromPermissions() {
        const menus = permissionStore.userMenus;
        if (!menus || menus.length === 0) {
            $Data.menuItems = [];
            return;
        }

        // 转换后端菜单数据为前端菜单格式
        const convertMenu = (menuItem: any): any => {
            // 使用 path 作为菜单值（用于路由跳转和激活状态匹配）
            const item: any = {
                value: menuItem.path || String(menuItem.id),
                label: menuItem.name,
                // 根据 icon 字段映射图标，如果没有则使用默认图标
                icon: menuItem.icon ? iconMap[menuItem.icon] || iconMap.default : iconMap.default
            };

            // 递归处理子菜单
            if (menuItem.children && menuItem.children.length > 0) {
                item.children = menuItem.children.map((child: any) => convertMenu(child));
            }

            return item;
        };

        $Data.menuItems = menus.map(convertMenu);
    },
    // 处理菜单切换
    handleMenuChange(value: string) {
        // 检查是否为目录（有子菜单的项不跳转）
        const findMenuItem = (items: any[], val: string): any => {
            for (const item of items) {
                if (item.value === val) return item;
                if (item.children) {
                    const found = findMenuItem(item.children, val);
                    if (found) return found;
                }
            }
            return null;
        };

        const menuItem = findMenuItem($Data.menuItems, value);

        // 只有没有子菜单的项才跳转
        if (menuItem && !menuItem.children) {
            // value 就是 path，直接跳转
            router.push({ path: value });
        }
    },
    // 处理用户菜单点击
    handleUserMenu(data: any) {
        if (data.value === 'logout') {
            localStorage.removeItem('token');
            permissionStore.clearPermissions();
            router.push('/login');
            MessagePlugin.success('退出成功');
        }
    }
};

// 组件挂载后构建菜单
onMounted(() => {
    console.log('[Layout] 组件已挂载');
    console.log('[Layout] 菜单数据:', permissionStore.userMenus);
    console.log('[Layout] 菜单数量:', permissionStore.userMenus.length);
    $Method.buildMenuFromPermissions();
    console.log('[Layout] 构建后的菜单项:', $Data.menuItems);
});
</script>

<style scoped lang="scss">
.layout-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--td-bg-color-page);
}

// 顶部导航栏
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: var(--td-bg-color-container);
    border-bottom: 1px solid var(--td-border-level-1-color);
    height: 64px;
    flex-shrink: 0;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.logo {
    display: flex;
    align-items: center;
}

.logo h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--td-text-color-primary);
}

.header-right {
    display: flex;
    align-items: center;
    gap: 16px;
}

.ml-2 {
    margin-left: 8px;
}

// 菜单栏（水平布局）
.menu-bar {
    height: 48px;
    flex-shrink: 0;
    background: var(--td-bg-color-container);
    border-bottom: 1px solid var(--td-border-level-1-color);
    padding: 0;
    display: flex;
    align-items: center;

    :deep(.t-menu) {
        width: 100%;
        border-bottom: none;
    }
}

// 内容区域
.content {
    flex: 1;
    background: var(--td-bg-color-page);
    overflow: hidden;
}
</style>
