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
                        <tiny-tag type="info" size="small">{{ $Data.userInfo.role || '超级管理员' }}</tiny-tag>
                    </div>
                    <tiny-button size="medium" :icon="iconClose()" @click="$Method.handleLogout" />
                </div>
            </div>
        </div>

        <!-- 菜单栏 -->
        <div class="layout-menu">
            <tiny-tree-menu :ref="(el) => ($From.treeMenuRef = el)" :data="$Data.userMenus" :props="{ label: 'name' }" node-key="id" :node-height="40" :show-filter="false" :default-expanded-keys="$Data.expandedKeys" style="height: 100%" only-check-children width-adapt @node-click="$Method.onMenuClick">
                <template #default="{ data }">
                    <span class="menu-item">
                        <i-lucide:square style="width: 16px; height: 16px; margin-right: 8px; vertical-align: middle" />
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
import { arrayToTree } from '@/utils';
import { iconClose } from '@opentiny/vue-icon';

const router = useRouter();
const route = useRoute();
const global = useGlobal();

// TreeMenu 组件引用

const $From = {
    treeMenuRef: null
};

// 响应式数据
const $Data = $ref({
    userMenus: [],
    userMenusFlat: [], // 一维菜单数据
    expandedKeys: [],
    currentNodeKey: 0,
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
            // 将一维数组转换为树形结构（最多2级）
            $Data.userMenus = arrayToTree(data);
            console.log('🔥[ $Data.userMenus ]-65', $Data.userMenus);
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
                expandedKeys.unshift(parent.id);
                menu = parent;
            } else {
                break;
            }
        }

        // 使用 nextTick 确保 DOM 更新后再设置高亮
        nextTick(() => {
            $Data.expandedKeys = expandedKeys;
            // 使用 setCurrentKey 方法设置当前高亮节点
            if ($From.treeMenuRef) {
                $From.treeMenuRef.setCurrentKey(currentMenu.id);
            }
        });
    },

    // 处理菜单点击
    onMenuClick(data) {
        if (data.path) {
            router.push(data.path);
        }
    },

    // 处理退出登录
    handleLogout() {
        Modal.confirm({
            message: '确定要退出登录吗？',
            title: '确认',
            onConfirm: () => {
                $Storage.local.remove('token');
                router.push('/internal/login');
                Message.success('退出成功');
            }
        });
    }
};

$Method.fetchUserMenus();
</script>

<style scoped lang="scss">
.layout-0-wrapper {
    $menu-width: 240px;
    $head-height: 64px;
    $gap: 16px;
    position: absolute;
    top: 0;
    left: 0;
    height: 100vh;
    width: 100vw;
    background: #f5f7fa;
    overflow: hidden;

    .layout-header {
        position: absolute;
        top: $gap;
        left: $gap;
        right: $gap;
        height: $head-height;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 15px;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        border: 1px solid #e8eaed;
        z-index: 100;

        .logo {
            h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 700;
                color: #1f2329;
                letter-spacing: 0.5px;
                background: linear-gradient(135deg, #0052d9 0%, #0084f4 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 16px;

            .user-info-bar {
                display: flex;
                align-items: center;
                gap: 12px;

                .user-avatar {
                    width: 32px;
                    height: 32px;
                    flex-shrink: 0;
                }

                .user-text {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;

                    .user-name {
                        font-size: 14px;
                        font-weight: 500;
                        color: $text-primary;
                    }
                }
            }
        }
    }

    .layout-menu {
        position: absolute;
        top: calc($head-height + $gap * 2);
        left: $gap;
        bottom: $gap;
        width: $menu-width;
        background: #ffffff;
        border-radius: 8px;
        z-index: 99;
        padding: 16px 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        border: 1px solid #e8eaed;

        .tiny-tree-menu:before {
            display: none;
        }

        .menu-item {
            display: flex;
            align-items: center;
            width: 100%;
            padding: 2px 0;
            transition: all 0.2s ease;

            &:hover {
                color: #0052d9;
            }
        }
    }

    .layout-main {
        position: absolute;
        top: calc($head-height + $gap * 2);
        left: calc($menu-width + $gap * 2);
        right: $gap;
        bottom: $gap;
        background: #f5f7fa;
    }
}
</style>
