<template>
    <div class="layout-0-wrapper">
        <!-- 顶部导航栏 -->
        <div class="layout-header">
            <div class="logo">
                <h2>Befly Admin</h2>
            </div>
            <div class="header-right">
                <tiny-dropdown title="管理员" trigger="click" border type="info" @item-click="$Method.handleUserMenu">
                    <template #dropdown>
                        <tiny-dropdown-menu>
                            <tiny-dropdown-item :item-data="{ value: 'profile' }">个人中心</tiny-dropdown-item>
                            <tiny-dropdown-item :item-data="{ value: 'logout' }" divided>退出登录</tiny-dropdown-item>
                        </tiny-dropdown-menu>
                    </template>
                </tiny-dropdown>
            </div>
        </div>

        <!-- 菜单栏 -->
        <div class="layout-menu">
            <tiny-tree-menu :data="$Data.userMenus" :props="{ label: 'name' }" node-key="id" :node-height="40" :show-filter="false" style="height: 100%" only-check-children width-adapt @node-click="$Method.onMenuClick">
                <template #default="{ data }">
                    <span class="menu-item">
                        <Icon :name="data.icon || 'Squircle'" :size="16" style="margin-right: 8px; vertical-align: middle" />
                        <span>{{ data.name }}</span>
                    </span>
                </template>
            </tiny-tree-menu>
        </div>

        <!-- 内容区域 -->
        <div class="layout-main">
            <RouterView />
        </div>
    </div>
</template>

<script setup>
const router = useRouter();
const route = useRoute();

// 响应式数据
const $Data = $ref({
    menuItems: [], // 菜单树
    userMenus: [], // 原始菜单数据
    menusLoaded: false, // 是否已加载菜单
    expandedKeys: [],
    currentMenuKey: ''
});

// 当前激活菜单
const activeMenu = computed(() => route.path);

// 方法
const $Method = {
    // 获取用户菜单权限
    async fetchUserMenus() {
        try {
            if (import.meta.env.DEV) {
                console.log('[Permission] 开始获取用户菜单...');
                console.log('[Permission] 当前 token:', localStorage.getItem('token')?.substring(0, 20) + '...');
            }
            const { data } = await $Http('/addon/admin/adminMenus');
            if (import.meta.env.DEV) {
                console.log('[Permission] 菜单数据:', data);
            }

            // 保存原始菜单数据
            $Data.userMenus = data;
        } catch (error) {
            console.error('获取用户菜单失败:', error);
        }
    },

    // 清空菜单权限数据
    clearMenus() {
        $Data.userMenus = [];
        $Data.menuItems = [];
    },

    // 根据当前路径查找对应的菜单项ID和父级ID
    findMenuByPath(menus, path, parentIds = []) {
        for (const menu of menus) {
            if (menu.url === path) {
                return { menuId: String(menu.id), parentIds };
            }
            if (menu.children && menu.children.length > 0) {
                const result = $Method.findMenuByPath(menu.children, path, [...parentIds, String(menu.id)]);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    },

    // 更新当前激活的菜单
    updateActiveMenu() {
        const currentPath = route.path;
        const result = $Method.findMenuByPath($Data.menuItems, currentPath);

        if (result) {
            // 设置当前选中的菜单（高亮）
            $Data.currentMenuKey = result.menuId;
            // 展开父级菜单
            $Data.expandedKeys = result.parentIds;
        }
    },

    // 处理菜单点击
    onMenuClick(data) {
        console.log('🔥[ data ]-111', data);
        router.push(data.path);
    },

    // 处理用户菜单点击
    handleUserMenu(data) {
        const value = data.itemData?.value || data.value;
        switch (value) {
            case 'profile':
                router.push('/profile');
                break;
            case 'logout':
                localStorage.removeItem('token');
                $Method.clearMenus();
                router.push('/login');
                Modal.message({ message: '退出成功', status: 'success' });
                break;
        }
    }
};

// 组件挂载后获取菜单权限并构建菜单
onMounted(async () => {
    // 如果还未加载菜单，先获取菜单数据
    await $Method.fetchUserMenus();
});
</script>

<style scoped lang="scss">
.layout-0-wrapper {
    $menu-width: 220px;
    $head-height: 64px;
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
        height: $head-height;
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
        top: $head-height;
        left: 0;
        bottom: 0;
        width: $menu-width;
        background: #ffffff;
        z-index: 99;
        padding-left: 10px;
        padding-right: 10px;
        border-right: 1px solid #eee;
        .tiny-tree-menu:before {
            display: none;
        }
        .menu-item {
            display: flex;
            align-items: center;
            width: 100%;
        }
    }

    .layout-main {
        position: absolute;
        top: $head-height;
        left: $menu-width;
        right: 0;
        bottom: 0;
    }
}
</style>
