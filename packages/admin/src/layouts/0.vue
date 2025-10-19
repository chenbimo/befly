<template>
    <div class="layout-0-wrapper">
        <!-- 顶部导航栏 -->
        <div class="layout-header">
            <div class="logo">
                <h2>Befly Admin</h2>
            </div>
            <div class="header-right">
                <tiny-dropdown :menu-options="userMenuOptions" @menu-item-click="$Method.handleUserMenu">
                    <tiny-button> 管理员 </tiny-button>
                </tiny-dropdown>
            </div>
        </div>

        <!-- 菜单栏 -->
        <div class="layout-menu">
            <tiny-tree-menu :data="$Data.menuItems" :default-expanded-keys="[]" :get-menu-data-sync="$Method.getMenuDataSync" @node-click="$Method.handleMenuClick" />
        </div>

        <!-- 内容区域 -->
        <div class="layout-main">
            <RouterView />
        </div>
    </div>
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

// 当前激活菜单
const activeMenu = computed(() => route.path);

// 用户菜单选项
const userMenuOptions = [
    { label: '个人中心', value: 'profile' },
    { label: '退出登录', value: 'logout' }
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

        // 转换为 TreeMenu 需要的格式
        const convertMenuItem = (item: any): any => {
            const menuItem: any = {
                id: String(item.id),
                label: item.name,
                url: item.path || ''
            };

            // 递归处理子菜单
            if (item.children && item.children.length > 0) {
                menuItem.children = item.children.map(convertMenuItem);
            }

            return menuItem;
        };

        $Data.menuItems = menus.map(convertMenuItem);
    },

    // TreeMenu 同步获取菜单数据
    getMenuDataSync() {
        return $Data.menuItems;
    },

    // 处理菜单点击
    handleMenuClick(data: any) {
        if (data.url) {
            router.push({ path: data.url });
        }
    },

    // 处理用户菜单点击
    handleUserMenu(data: any) {
        if (data.itemData.value === 'logout') {
            localStorage.removeItem('token');
            permissionStore.clearPermissions();
            router.push('/login');
            Modal.message({ message: '退出成功', status: 'success' });
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
    background: #f5f5f5;
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
        background: #ffffff;
        border-bottom: 1px solid #e0e0e0;
        z-index: 100;

        .logo {
            h2 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #333;
            }
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
    }

    .layout-menu {
        position: absolute;
        top: 64px;
        left: 0;
        right: 0;
        height: 48px;
        background: #ffffff;
        border-bottom: 1px solid #e0e0e0;
        padding: 0 24px;
        z-index: 99;
        display: flex;
        align-items: center;
    }

    .layout-main {
        position: absolute;
        top: 112px;
        left: 0;
        right: 0;
        bottom: 0;
        overflow: auto;
    }
}
</style>
