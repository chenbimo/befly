<template>
    <div class="layout-wrapper" :class="{ 'sidebar-collapsed': $Data.isCollapsed }">
        <!-- 左侧边栏：Logo + 菜单 + 底部操作 -->
        <div class="layout-sidebar">
            <!-- Logo 区域 -->
            <div class="sidebar-logo">
                <div class="logo-icon">
                    <i-lucide:box style="width: 24px; height: 24px; color: var(--primary-color)" />
                </div>
                <h2 v-show="!$Data.isCollapsed">{{ $Config.appTitle }}</h2>
            </div>

            <!-- 菜单区域 -->
            <div class="sidebar-menu">
                <t-menu v-model:value="$Data.currentMenuKey" v-model:expanded="$Data.expandedKeys" :collapsed="$Data.isCollapsed" width="220px" @change="$Method.onMenuClick">
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

            <!-- 底部操作区域 -->
            <div class="sidebar-footer">
                <!-- 折叠按钮 -->
                <div class="footer-item collapse-btn" @click="$Method.toggleCollapse">
                    <i-lucide:panel-left-close v-if="!$Data.isCollapsed" style="width: 18px; height: 18px" />
                    <i-lucide:panel-left-open v-else style="width: 18px; height: 18px" />
                    <span v-show="!$Data.isCollapsed">收起菜单</span>
                </div>
                <div class="footer-item" @click="$Method.handleSettings">
                    <i-lucide:settings style="width: 18px; height: 18px" />
                    <span v-show="!$Data.isCollapsed">系统设置</span>
                </div>
                <div class="footer-user">
                    <t-upload v-show="!$Data.isCollapsed" :action="$Config.uploadUrl" :headers="{ Authorization: $Storage.local.get('token') }" :show-upload-list="false" accept="image/*" @success="$Method.onAvatarUploadSuccess">
                        <div class="user-avatar" :class="{ 'has-avatar': $Data.userInfo.avatar }">
                            <img v-if="$Data.userInfo.avatar" :src="$Data.userInfo.avatar" alt="avatar" />
                            <i-lucide:user v-else style="width: 16px; height: 16px; color: #fff" />
                            <div class="avatar-overlay">
                                <i-lucide:camera style="width: 14px; height: 14px; color: #fff" />
                            </div>
                        </div>
                    </t-upload>
                    <div v-show="$Data.isCollapsed" class="user-avatar">
                        <img v-if="$Data.userInfo.avatar" :src="$Data.userInfo.avatar" alt="avatar" />
                        <i-lucide:user v-else style="width: 16px; height: 16px; color: #fff" />
                    </div>
                    <div v-show="!$Data.isCollapsed" class="user-info">
                        <span class="user-name">{{ $Data.userInfo.nickname || '管理员' }}</span>
                        <span class="user-role">{{ $Data.userInfo.role || '超级管理员' }}</span>
                    </div>
                    <t-button v-show="!$Data.isCollapsed" theme="default" variant="text" size="small" @click="$Method.handleLogout">
                        <template #icon>
                            <i-lucide:log-out style="width: 16px; height: 16px" />
                        </template>
                    </t-button>
                </div>
            </div>
        </div>

        <!-- 右侧内容区域 -->
        <div class="layout-main">
            <RouterView />
        </div>
    </div>
</template>

<script setup>
import { arrayToTree } from 'befly-shared/arrayToTree';

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
    isCollapsed: false, // 菜单折叠状态
    userInfo: {
        nickname: '管理员',
        role: '超级管理员',
        avatar: '' // 用户头像
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
    },

    // 处理系统设置
    handleSettings() {
        router.push('/addon/admin/settings');
    },

    // 切换菜单折叠状态
    toggleCollapse() {
        $Data.isCollapsed = !$Data.isCollapsed;
        // 保存折叠状态到本地存储
        $Storage.local.set('sidebarCollapsed', $Data.isCollapsed);
    },

    // 头像上传成功
    onAvatarUploadSuccess(res) {
        if (res.response?.code === 0 && res.response?.data?.url) {
            $Data.userInfo.avatar = res.response.data.url;
            MessagePlugin.success('头像上传成功');
            // TODO: 可以调用接口保存用户头像
        }
    },

    // 初始化折叠状态
    initCollapsedState() {
        const collapsed = $Storage.local.get('sidebarCollapsed');
        if (collapsed !== null) {
            $Data.isCollapsed = collapsed;
        }
    }
};

$Method.initCollapsedState();
$Method.fetchUserMenus();
</script>

<style scoped lang="scss">
.layout-wrapper {
    display: flex;
    height: 100vh;
    width: 100vw;
    background: var(--bg-color-page);
    padding: var(--layout-gap);
    gap: var(--layout-gap);
    overflow: hidden;

    // 折叠状态
    &.sidebar-collapsed {
        .layout-sidebar {
            width: 64px;

            .sidebar-logo {
                padding: var(--spacing-md);
                justify-content: center;
            }

            .sidebar-footer {
                .footer-item {
                    justify-content: center;
                    padding: var(--spacing-sm);
                }

                .footer-user {
                    justify-content: center;
                    padding: var(--spacing-sm);
                }
            }
        }
    }

    // 左侧边栏
    .layout-sidebar {
        width: var(--sidebar-width);
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        background: var(--bg-color-container);
        border-radius: var(--border-radius-large);
        box-shadow: var(--shadow-1);
        overflow: hidden;
        transition: width var(--transition-normal);

        // Logo 区域
        .sidebar-logo {
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            padding: var(--spacing-lg) var(--spacing-md);
            border-bottom: 1px solid var(--border-color-light);
            transition: all var(--transition-normal);

            .logo-icon {
                width: 40px;
                height: 40px;
                min-width: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--primary-color-light);
                border-radius: var(--border-radius);
            }

            h2 {
                margin: 0;
                font-size: var(--font-size-lg);
                font-weight: var(--font-weight-semibold);
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
            }
        }

        // 菜单区域
        .sidebar-menu {
            flex: 1;
            overflow-y: auto;
            padding: var(--spacing-sm) 0;

            :deep(.t-menu) {
                border-right: none;
                background: transparent;

                .t-menu__item {
                    margin: 2px var(--spacing-sm);
                    border-radius: var(--border-radius);
                    transition: all var(--transition-fast);

                    &:hover {
                        background-color: var(--bg-color-hover);
                    }

                    &.t-is-active {
                        background-color: var(--primary-color-light);
                        color: var(--primary-color);
                        font-weight: var(--font-weight-medium);
                    }
                }

                .t-submenu {
                    .t-submenu__header {
                        margin: 2px var(--spacing-sm);
                        border-radius: var(--border-radius);
                    }
                }

                .t-submenu__content {
                    background-color: transparent;
                }
            }
        }

        // 底部操作区域
        .sidebar-footer {
            border-top: 1px solid var(--border-color-light);
            padding: var(--spacing-sm);

            .footer-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: var(--spacing-sm) var(--spacing-md);
                border-radius: var(--border-radius);
                color: var(--text-secondary);
                cursor: pointer;
                transition: all var(--transition-fast);

                &:hover {
                    background-color: var(--bg-color-hover);
                    color: var(--text-primary);
                }

                span {
                    font-size: var(--font-size-sm);
                    white-space: nowrap;
                }

                &.collapse-btn {
                    color: var(--text-placeholder);
                }
            }

            .footer-user {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: var(--spacing-sm);
                margin-top: var(--spacing-xs);
                background: var(--bg-color-secondarycontainer);
                border-radius: var(--border-radius);
                transition: all var(--transition-fast);

                .user-avatar {
                    width: 32px;
                    height: 32px;
                    min-width: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--primary-color);
                    border-radius: 50%;
                    flex-shrink: 0;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;

                    img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }

                    .avatar-overlay {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0;
                        transition: opacity var(--transition-fast);
                    }

                    &:hover .avatar-overlay {
                        opacity: 1;
                    }
                }

                .user-info {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;

                    .user-name {
                        font-size: var(--font-size-sm);
                        font-weight: var(--font-weight-medium);
                        color: var(--text-primary);
                        line-height: 1.3;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .user-role {
                        font-size: var(--font-size-xs);
                        color: var(--text-placeholder);
                        line-height: 1.3;
                    }
                }
            }
        }
    }

    // 右侧主内容区域
    .layout-main {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }
}
</style>
