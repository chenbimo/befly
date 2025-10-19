<template>
    <div class="layout-0-wrapper">
        <!-- 顶部导航栏 -->
        <div class="layout-header">
            <div class="logo">
                <h2>Befly Admin</h2>
            </div>
            <div class="header-right">
                <t-dropdown :options="userMenuOptions" @click="$Method.handleUserMenu">
                    <t-button variant="text">
                        <user-icon />
                        <span class="ml-2">管理员</span>
                    </t-button>
                </t-dropdown>
            </div>
        </div>

        <!-- 菜单栏 -->
        <div class="layout-menu">
            <t-menu :value="activeMenu" @change="$Method.handleMenuChange" mode="horizontal" theme="light" width="240px">
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
        </div>

        <!-- 内容区域 -->
        <div class="layout-main">
            <RouterView />
        </div>
    </div>
</template>

<script setup lang="ts">
import { usePermissionStore } from '@/stores/permission';
import { DashboardIcon, HomeIcon, UserIcon, FileIcon, SettingIcon, ViewListIcon, AppIcon } from 'tdesign-icons-vue-next';

const router = useRouter();
const route = useRoute();
const permissionStore = usePermissionStore();

// 响应式数据
const $Data = $ref({
    menuItems: [] as any[]
});

// 当前激活菜单
const activeMenu = computed(() => route.path);

// 图标映射
const iconMap: Record<string, any> = {
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
    DashboardIcon: markRaw(DashboardIcon),
    HomeIcon: markRaw(HomeIcon),
    UserIcon: markRaw(UserIcon),
    FileIcon: markRaw(FileIcon),
    SettingIcon: markRaw(SettingIcon),
    ViewListIcon: markRaw(ViewListIcon),
    AppIcon: markRaw(AppIcon),
    default: markRaw(AppIcon)
};

// 用户菜单选项
const userMenuOptions = [
    { content: '个人中心', value: 'profile' },
    { content: '退出登录', value: 'logout' }
];

// 方法
const $Method = {
    // 构建菜单
    buildMenuFromPermissions() {
        const menus = permissionStore.userMenus;
        if (!menus || menus.length === 0) {
            $Data.menuItems = [];
            return;
        }

        const convertMenu = (menuItem: any): any => {
            const item: any = {
                value: menuItem.path || String(menuItem.id),
                label: menuItem.name,
                icon: menuItem.icon ? iconMap[menuItem.icon] || iconMap.default : iconMap.default
            };

            if (menuItem.children && menuItem.children.length > 0) {
                item.children = menuItem.children.map((child: any) => convertMenu(child));
            }

            return item;
        };

        $Data.menuItems = menus.map(convertMenu);
    },
    // 处理菜单切换
    handleMenuChange(value: string) {
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
        if (menuItem && !menuItem.children) {
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
    $Method.buildMenuFromPermissions();
});
</script>

<style scoped lang="scss">
.layout-0-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    height: 100vh;
    width: 100vw;
    background: var(--td-bg-color-page);
    overflow: hidden;

    .layout-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 24px;
        background: #fff;
        border-bottom: 1px solid var(--td-border-level-1-color);
        z-index: 100;

        .logo {
            h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: var(--td-text-color-primary);
            }
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 16px;

            .ml-2 {
                margin-left: 8px;
            }
        }
    }

    .layout-menu {
        position: absolute;
        top: 64px;
        left: 0;
        right: 0;
        width: 240px;
        bottom: 0;
        background: #fff;
        border-bottom: 1px solid var(--td-border-level-1-color);
        z-index: 99;
    }

    .layout-main {
        position: absolute;
        top: 64px;
        left: 240px;
        right: 0;
        bottom: 0;
        overflow: auto;
    }
}
</style>
